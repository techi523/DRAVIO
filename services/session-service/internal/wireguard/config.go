package wireguard

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"

	"golang.zx2c4.com/wireguard/wgctrl/wgtypes"
)

// GenerateKeyPair generates a new WireGuard private/public key pair
func GenerateKeyPair() (string, string, error) {
	key, err := wgtypes.GeneratePrivateKey()
	if err != nil {
		return "", "", err
	}
	return key.String(), key.PublicKey().String(), nil
}

// GeneratePresharedKey generates a random preshared key for extra security
func GeneratePresharedKey() (string, error) {
var k [32]byte
if _, err := rand.Read(k[:]); err != nil {
return "", err
}
return base64.StdEncoding.EncodeToString(k[:]), nil
}

// CreateConfigTemplate returns a string representing a WireGuard client config
func CreateConfigTemplate(privateKey, address, endpoint, serverPublicKey string) string {
return fmt.Sprintf(`[Interface]
PrivateKey = %s
Address = %s
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = %s
Endpoint = %s
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`, privateKey, address, serverPublicKey, endpoint)
}

