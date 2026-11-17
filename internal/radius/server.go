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

	errCh := make(chan error, 2)
	var wg sync.WaitGroup

	wg.Add(2)
	go func() {
		defer wg.Done()
		s.logger.Info("radius authentication listening", slog.String("addr", s.authAddr))
		if err := authServer.ListenAndServe(); err != nil && err != radius.ErrServerShutdown {
			errCh <- fmt.Errorf("auth listener: %w", err)
		}
	}()
	go func() {
		defer wg.Done()
		s.logger.Info("radius accounting listening", slog.String("addr", s.acctAddr))
		if err := acctServer.ListenAndServe(); err != nil && err != radius.ErrServerShutdown {
			errCh <- fmt.Errorf("accounting listener: %w", err)
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
	case err := <-errCh:
		_ = authServer.Shutdown(context.Background())
		_ = acctServer.Shutdown(context.Background())
		wg.Wait()
		return err
	}
}

// secretSourceFunc adapts a function to the radius.SecretSource interface.
type secretSourceFunc func(ctx context.Context, remoteAddr net.Addr) ([]byte, error)

func (f secretSourceFunc) RADIUSSecret(ctx context.Context, remoteAddr net.Addr) ([]byte, error) {
	return f(ctx, remoteAddr)
}

// secretSource resolves the shared secret from the source IP. Unknown peers are
// dropped before the packet is decoded, so a wrong secret never yields access.
func (s *Server) secretSource() radius.SecretSource {
	return secretSourceFunc(func(ctx context.Context, remoteAddr net.Addr) ([]byte, error) {
		_, secret, err := s.auth.LookupNAS(ctx, remoteAddr.String())
		if err != nil {
			return nil, err
		}
		return []byte(secret), nil
	})
}
