package storage

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// R2Client is a lightweight S3-compatible client for Cloudflare R2 using AWS Signature V4.
type R2Client struct {
	accountID       string
	accessKeyID     string
	secretAccessKey string
	bucketName      string
	publicBaseURL   string
	httpClient      *http.Client
}

// R2Options holds configuration for Cloudflare R2.
type R2Options struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	BucketName      string
	PublicBaseURL   string
}

// NewR2Client creates a Cloudflare R2 client.
func NewR2Client(opts R2Options) *R2Client {
	return &R2Client{
		accountID:       strings.TrimSpace(opts.AccountID),
		accessKeyID:     strings.TrimSpace(opts.AccessKeyID),
		secretAccessKey: strings.TrimSpace(opts.SecretAccessKey),
		bucketName:      strings.TrimSpace(opts.BucketName),
		publicBaseURL:   strings.TrimRight(strings.TrimSpace(opts.PublicBaseURL), "/"),
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// Enabled reports whether all required R2 credentials are configured.
func (c *R2Client) Enabled() bool {
	return c != nil && c.accountID != "" && c.accessKeyID != "" && c.secretAccessKey != "" && c.bucketName != ""
}

// PublicURL returns the public r2.dev / custom domain URL for an object key if configured.
func (c *R2Client) PublicURL(key string) string {
	key = strings.TrimLeft(key, "/")
	if c == nil || c.publicBaseURL == "" {
		return "/uploads/" + key
	}
	return c.publicBaseURL + "/" + key
}

// PutObject uploads an object to Cloudflare R2 using S3 AWS Signature Version 4.
func (c *R2Client) PutObject(ctx context.Context, key string, data []byte, contentType string) error {
	if !c.Enabled() {
		return fmt.Errorf("r2 client is not configured")
	}
	key = strings.TrimLeft(key, "/")
	host := fmt.Sprintf("%s.r2.cloudflarestorage.com", c.accountID)
	uri := fmt.Sprintf("/%s/%s", c.bucketName, key)
	endpoint := "https://" + host + uri

	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")

	payloadHash := sha256Hex(data)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, bytes.NewReader(data))
	if err != nil {
		return err
	}
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	req.Header.Set("Host", host)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)
	req.Header.Set("X-Amz-Date", amzDate)
	req.ContentLength = int64(len(data))

	canonicalHeaders := fmt.Sprintf(
		"content-type:%s\nhost:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n",
		contentType, host, payloadHash, amzDate,
	)
	signedHeaders := "content-type;host;x-amz-content-sha256;x-amz-date"

	authHeader := c.signV4(http.MethodPut, uri, "", canonicalHeaders, signedHeaders, payloadHash, amzDate, dateStamp)
	req.Header.Set("Authorization", authHeader)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("r2 put failed (status %d): %s", resp.StatusCode, string(body))
	}
	return nil
}

// GetObject fetches an object from Cloudflare R2.
func (c *R2Client) GetObject(ctx context.Context, key string) ([]byte, string, error) {
	if !c.Enabled() {
		return nil, "", fmt.Errorf("r2 client is not configured")
	}
	key = strings.TrimLeft(key, "/")
	host := fmt.Sprintf("%s.r2.cloudflarestorage.com", c.accountID)
	uri := fmt.Sprintf("/%s/%s", c.bucketName, key)
	endpoint := "https://" + host + uri

	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")
	emptyHash := sha256Hex(nil)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Host", host)
	req.Header.Set("X-Amz-Content-Sha256", emptyHash)
	req.Header.Set("X-Amz-Date", amzDate)

	canonicalHeaders := fmt.Sprintf(
		"host:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n",
		host, emptyHash, amzDate,
	)
	signedHeaders := "host;x-amz-content-sha256;x-amz-date"

	authHeader := c.signV4(http.MethodGet, uri, "", canonicalHeaders, signedHeaders, emptyHash, amzDate, dateStamp)
	req.Header.Set("Authorization", authHeader)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, "", fmt.Errorf("r2 get failed (status %d): %s", resp.StatusCode, string(body))
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}
	return data, resp.Header.Get("Content-Type"), nil
}

func (c *R2Client) signV4(method, canonicalURI, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash, amzDate, dateStamp string) string {
	region := "auto"
	service := "s3"

	canonicalRequest := strings.Join([]string{
		method,
		canonicalURI,
		canonicalQuery,
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")

	credentialScope := fmt.Sprintf("%s/%s/%s/aws4_request", dateStamp, region, service)
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")

	kDate := hmacSHA256([]byte("AWS4"+c.secretAccessKey), []byte(dateStamp))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte(service))
	kSigning := hmacSHA256(kService, []byte("aws4_request"))
	signature := hex.EncodeToString(hmacSHA256(kSigning, []byte(stringToSign)))

	return fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		c.accessKeyID, credentialScope, signedHeaders, signature,
	)
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func hmacSHA256(key, data []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write(data)
	return mac.Sum(nil)
}
