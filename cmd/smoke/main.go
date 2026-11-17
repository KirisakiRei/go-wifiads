package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

func main() {
	base := getenv("SMOKE_BASE_URL", "http://localhost:8080")
	client := &http.Client{Timeout: 10 * time.Second}

	session := postJSON(client, base+"/api/v1/portal-sessions", map[string]any{
		"mac": "AA:BB:CC:DD:EE:11",
		"ip":  "10.5.50.10",
	})
	token := str(session["session_token"])
	fmt.Printf("portal session: token=%s status=%v ad_wait=%v\n", token[:8]+"...", session["status"], session["ad_duration_seconds"])
	if token == "" {
		die("portal session did not return a token")
	}

	early, earlyStatus := postJSONStatus(client, base+"/api/v1/portal-sessions/"+token+"/connect")
	fmt.Printf("connect too early: http=%d message=%v\n", earlyStatus, early["message"])
	if earlyStatus == 200 {
		die("connect before the countdown should be rejected")
	}

	time.Sleep(2500 * time.Millisecond)

	connect := postJSON(client, base+"/api/v1/portal-sessions/"+token+"/connect", map[string]any{})
	fmt.Printf("voucher issued: user=%v pass=%v mode=%v\n", connect["username"], connect["password"], connect["auth_mode"])
	if str(connect["username"]) == "" {
		die("connect did not issue a voucher")
	}

	again := postJSON(client, base+"/api/v1/portal-sessions/"+token+"/connect", map[string]any{})
	if str(again["username"]) != str(connect["username"]) {
		die("connect is not idempotent")
	}
	fmt.Println("connect idempotent: ok")

	if os.Getenv("SMOKE_RADIUS") == "1" {
		verifyRadius(
			str(connect["username"]),
			str(connect["password"]),
			"AA:BB:CC:DD:EE:11",
			getenv("SMOKE_NAS_IDENTIFIER", "alpha-router-01"),
		)
	}

	login := postJSON(client, base+"/api/v1/admin/auth/login", map[string]any{
		"username": getenv("SMOKE_ADMIN_USERNAME", "admin"),
		"password": getenv("SMOKE_ADMIN_PASSWORD", "admin12345"),
	})
	adminToken := str(login["token"])
	if adminToken == "" {
		die("admin login failed")
	}
	fmt.Println("admin login: ok")

	voucher := authJSON(client, http.MethodPost, base+"/api/v1/admin/vouchers", adminToken, map[string]any{"note": "smoke test"})
	fmt.Printf("manual voucher: user=%v pass=%v\n", voucher["username"], voucher["password"])
	if str(voucher["username"]) == "" {
		die("manual voucher creation failed")
	}

	overview := authJSON(client, http.MethodGet, base+"/api/v1/admin/overview", adminToken, nil)
	fmt.Printf("overview: %v\n", overview)
	fmt.Println("SMOKE OK")
}

// --- helpers ---

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func str(value any) string {
	text, _ := value.(string)
	return text
}

func die(message string) {
	fmt.Fprintf(os.Stderr, "SMOKE FAILED: %s\n", message)
	os.Exit(1)
}

func decode(body io.Reader) map[string]any {
	var payload map[string]any
	if err := json.NewDecoder(body).Decode(&payload); err != nil {
		return map[string]any{}
	}
	return payload
}

func dataOf(body io.Reader) map[string]any {
	payload := decode(body)
	if mapped, ok := payload["data"].(map[string]any); ok {
		return mapped
	}
	return map[string]any{}
}

func postJSON(client *http.Client, url string, payload map[string]any) map[string]any {
	result, status := doPost(client, url, payload)
	if status >= 300 {
		die(fmt.Sprintf("POST %s returned %d: %v", url, status, result["message"]))
	}
	if mapped, ok := result["data"].(map[string]any); ok {
		return mapped
	}
	return result
}

func postJSONStatus(client *http.Client, url string) (map[string]any, int) {
	payload, status := doPost(client, url, nil)
	if mapped, ok := payload["data"].(map[string]any); ok {
		return mapped, status
	}
	return payload, status
}

func doPost(client *http.Client, url string, payload map[string]any) (map[string]any, int) {
	body := "{}"
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			die("encode payload: " + err.Error())
		}
		body = string(encoded)
	}
	response, err := client.Post(url, "application/json", strings.NewReader(body))
	if err != nil {
		die("POST " + url + ": " + err.Error())
	}
	defer response.Body.Close()
	return decode(response.Body), response.StatusCode
}

func authJSON(client *http.Client, method, url, token string, payload map[string]any) map[string]any {
	var body io.Reader = strings.NewReader("{}")
	if payload != nil {
		encoded, _ := json.Marshal(payload)
		body = strings.NewReader(string(encoded))
	}
	request, err := http.NewRequest(method, url, body)
	if err != nil {
		die("build request: " + err.Error())
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+token)
	response, err := client.Do(request)
	if err != nil {
		die(method + " " + url + ": " + err.Error())
	}
	defer response.Body.Close()
	if response.StatusCode >= 300 {
		die(fmt.Sprintf("%s %s returned %d", method, url, response.StatusCode))
	}
	return dataOf(response.Body)
}
