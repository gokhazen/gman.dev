import http.server
import socketserver
import os
import socket
import json

PORT = 5000

# Sunucunun çalışacağı dizin
current_directory = os.path.dirname(os.path.abspath(__file__))
os.chdir(current_directory)

# Yerel IP'yi güvenilir şekilde tespit et
def get_local_ip():
    try:
        # Bu bağlantı aslında yapılmaz, sadece IP belirlemek için kullanılır
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))  # Google DNS üzerinden rota belirlenir
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

local_ip = get_local_ip()

# HTTP istek işleyicisi - POST desteği eklendi
class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/location':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            # Gelen veriyi (opsiyonel) loglayabiliriz
            # print(f"Location received: {post_data.decode()}")
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {"status": "success", "message": "Location updated"}
            self.wfile.write(json.dumps(response).encode())
        else:
            super().do_POST()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type")
        self.end_headers()

with socketserver.TCPServer(("0.0.0.0", PORT), CustomHandler) as httpd:
    print(f"Sunucu {PORT} portunda çalışıyor...")
    print(f"Tarayıcınızda açabilirsiniz:")
    print(f"  Lokal:      http://localhost:{PORT}")
    print(f"  Yerel IP:   http://{local_ip}:{PORT}")
    httpd.serve_forever()
