package radius

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net"
	"sync"
	"time"

	"layeh.com/radius"

	"wifiads/internal/service"
)

// Server runs the RADIUS authentication and accounting listeners.
type Server struct {
	auth       service.RadiusAuthenticator
	accounting service.RadiusAccountant
	logger     *slog.Logger

	authAddr string
	acctAddr string

	// recentNASByIP maps a peer's source IP to the NAS-Identifier (RFC 2865 Attr 32)
	// inspected from its incoming UDP packet so routers on Dynamic ISP Public IPs
	// are identified by NAS-Identifier rather than a static IP.
	recentNASByIP sync.Map
}

// NewServer builds the RADIUS transport.
func NewServer(
	auth service.RadiusAuthenticator,
	accounting service.RadiusAccountant,
	logger *slog.Logger,
	authAddr, acctAddr string,
) *Server {
	return &Server{
		auth:       auth,
		accounting: accounting,
		logger:     logger,
		authAddr:   authAddr,
		acctAddr:   acctAddr,
	}
}

// nasInspectingPacketConn wraps net.PacketConn to peek at RFC 2865 Attribute 32
// (NAS-Identifier) before layeh.com/radius invokes SecretSource.
type nasInspectingPacketConn struct {
	net.PacketConn
	server *Server
}

func (c *nasInspectingPacketConn) ReadFrom(p []byte) (int, net.Addr, error) {
	n, addr, err := c.PacketConn.ReadFrom(p)
	if err == nil && n >= 20 && addr != nil {
		if nasID := extractNASIdentifier(p[:n]); nasID != "" {
			host, _, splitErr := net.SplitHostPort(addr.String())
			if splitErr != nil {
				host = addr.String()
			}
			c.server.recentNASByIP.Store(host, nasID)
		}
	}
	return n, addr, err
}

// extractNASIdentifier parses the 20-byte RADIUS header and walks the TLV attributes
// to return Attribute 32 (NAS-Identifier) if present.
func extractNASIdentifier(pkt []byte) string {
	if len(pkt) < 20 {
		return ""
	}
	length := int(pkt[2])<<8 | int(pkt[3])
	if length > len(pkt) {
		length = len(pkt)
	}
	offset := 20
	for offset+2 <= length {
		attrType := pkt[offset]
		attrLen := int(pkt[offset+1])
		if attrLen < 2 || offset+attrLen > length {
			break
		}
		if attrType == 32 && attrLen > 2 {
			return string(pkt[offset+2 : offset+attrLen])
		}
		offset += attrLen
	}
	return ""
}

// Run starts both listeners and blocks until ctx is cancelled.
func (s *Server) Run(ctx context.Context) error {
	authServer := &radius.PacketServer{
		Addr:         s.authAddr,
		Handler:      radius.HandlerFunc(s.handleAuth),
		SecretSource: s.secretSource(),
		ErrorLog:     log.New(newSlogWriter(s.logger), "", 0),
	}
	acctServer := &radius.PacketServer{
		Addr:         s.acctAddr,
		Handler:      radius.HandlerFunc(s.handleAccounting),
		SecretSource: s.secretSource(),
		ErrorLog:     log.New(newSlogWriter(s.logger), "", 0),
	}

	authConn, err := net.ListenPacket("udp", s.authAddr)
	if err != nil {
		return fmt.Errorf("listen auth udp %s: %w", s.authAddr, err)
	}
	acctConn, err := net.ListenPacket("udp", s.acctAddr)
	if err != nil {
		_ = authConn.Close()
		return fmt.Errorf("listen acct udp %s: %w", s.acctAddr, err)
	}

	errCh := make(chan error, 2)
	var wg sync.WaitGroup

	wg.Add(2)
	go func() {
		defer wg.Done()
		s.logger.Info("radius authentication listening (dynamic NAS-Identifier enabled)", slog.String("addr", s.authAddr))
		if serveErr := authServer.Serve(&nasInspectingPacketConn{PacketConn: authConn, server: s}); serveErr != nil && serveErr != radius.ErrServerShutdown {
			errCh <- fmt.Errorf("auth listener: %w", serveErr)
		}
	}()
	go func() {
		defer wg.Done()
		s.logger.Info("radius accounting listening (dynamic NAS-Identifier enabled)", slog.String("addr", s.acctAddr))
		if serveErr := acctServer.Serve(&nasInspectingPacketConn{PacketConn: acctConn, server: s}); serveErr != nil && serveErr != radius.ErrServerShutdown {
			errCh <- fmt.Errorf("accounting listener: %w", serveErr)
		}
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = authServer.Shutdown(shutdownCtx)
		_ = acctServer.Shutdown(shutdownCtx)
		wg.Wait()
		return nil
	case runErr := <-errCh:
		_ = authServer.Shutdown(context.Background())
		_ = acctServer.Shutdown(context.Background())
		wg.Wait()
		return runErr
	}
}

// secretSourceFunc adapts a function to the radius.SecretSource interface.
type secretSourceFunc func(ctx context.Context, remoteAddr net.Addr) ([]byte, error)

func (f secretSourceFunc) RADIUSSecret(ctx context.Context, remoteAddr net.Addr) ([]byte, error) {
	return f(ctx, remoteAddr)
}

// secretSource resolves the shared secret using the packet's NAS-Identifier first
// (supporting dynamic ISP public IPs) and falls back to source IP lookup.
func (s *Server) secretSource() radius.SecretSource {
	return secretSourceFunc(func(ctx context.Context, remoteAddr net.Addr) ([]byte, error) {
		host, _, err := net.SplitHostPort(remoteAddr.String())
		if err != nil {
			host = remoteAddr.String()
		}
		nasIdent := ""
		if val, ok := s.recentNASByIP.Load(host); ok {
			nasIdent, _ = val.(string)
		}
		target := remoteAddr.String()
		if nasIdent != "" {
			target = host + "|" + nasIdent
		}
		_, secret, lookupErr := s.auth.LookupNAS(ctx, target)
		if lookupErr != nil {
			return nil, lookupErr
		}
		return []byte(secret), nil
	})
}
