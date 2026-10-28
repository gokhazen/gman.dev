import http.server
import socketserver
import os
import socket

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

# HTTP istek işleyicisi
handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("0.0.0.0", PORT), handler) as httpd:
    print(f"Sunucu {PORT} portunda çalışıyor...")
    print(f"Tarayıcınızda açabilirsiniz:")
    print(f"  Lokal:      http://localhost:{PORT}")
    print(f"  Yerel IP:   http://{local_ip}:{PORT}")
    httpd.serve_forever()
