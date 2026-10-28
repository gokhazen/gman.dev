import os
import sys
try:
    from PIL import Image
except ImportError:
    print("Pillow kütüphanesi bulunamadı! Yüklemek için şu komutu çalıştırın:")
    print("pip install Pillow")
    sys.exit(1)

def generate_icons():
    # Klasör yolları
    assets_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(assets_dir)
    
    source_icon_path = os.path.join(assets_dir, 'icon.png')
    
    if not os.path.exists(source_icon_path):
        print(f"HATA: Kaynak görsel bulunamadı: {source_icon_path}")
        print("Lütfen assets klasörüne 'icon.png' adlı bir görsel koyun.")
        sys.exit(1)
        
    print(f"Kaynak görsel yüklendi: {source_icon_path}")
    img = Image.open(source_icon_path).convert("RGBA")
    
    # Hedefler
    targets = [
        # 1. Ana dizindeki favicon
        {
            'path': os.path.join(root_dir, 'favicon.ico'),
            'type': 'ico',
            'sizes': [(16, 16), (32, 32), (48, 48), (64, 64)]
        },
        # 2. ekodata içindeki favicon
        {
            'path': os.path.join(root_dir, 'ekodata', 'favicon.ico'),
            'type': 'ico',
            'sizes': [(16, 16), (32, 32), (48, 48), (64, 64)]
        },
        # 3. ekodata içindeki PWA ikonu (icon-512.png)
        {
            'path': os.path.join(root_dir, 'ekodata', 'icon-512.png'),
            'type': 'png',
            'size': (512, 512)
        }
    ]
    
    # 4. icons/ klasöründeki webp boyutları (PWA Manifest için)
    webp_sizes = [48, 72, 96, 128, 192, 256, 512]
    icons_dir = os.path.join(root_dir, 'icons')
    
    if not os.path.exists(icons_dir):
        os.makedirs(icons_dir)
        print(f"Klasör oluşturuldu: {icons_dir}")

    # WebP hedeflerini listeye ekle
    for size in webp_sizes:
        targets.append({
            'path': os.path.join(icons_dir, f'icon-{size}.webp'),
            'type': 'webp',
            'size': (size, size)
        })

    # 5. Android res/ klasöründeki ikonlar (Capacitor)
    android_res_dir = os.path.join(root_dir, 'appdevelopment', 'android', 'app', 'src', 'main', 'res')
    android_sizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192
    }
    
    if os.path.exists(android_res_dir):
        for mipmap_folder, size in android_sizes.items():
            folder_path = os.path.join(android_res_dir, mipmap_folder)
            for icon_name in ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']:
                targets.append({
                    'path': os.path.join(folder_path, icon_name),
                    'type': 'png',
                    'size': (size, size)
                })

    # Dosyaları oluştur
    for target in targets:
        path = target['path']
        file_type = target['type']
        
        # Hedef klasörün var olduğundan emin ol
        os.makedirs(os.path.dirname(path), exist_ok=True)
        
        if file_type == 'ico':
            # ICO formatı özel olarak farklı boyutları destekler
            img.save(path, format='ICO', sizes=target['sizes'])
            print(f"[BASARILI] Olusturuldu: {os.path.relpath(path, root_dir)}")
            
        elif file_type == 'png':
            resized_img = img.resize(target['size'], Image.Resampling.LANCZOS)
            resized_img.save(path, format='PNG')
            print(f"[BASARILI] Olusturuldu: {os.path.relpath(path, root_dir)}")
            
        elif file_type == 'webp':
            resized_img = img.resize(target['size'], Image.Resampling.LANCZOS)
            resized_img.save(path, format='WEBP', quality=100)
            print(f"[BASARILI] Olusturuldu: {os.path.relpath(path, root_dir)}")

    print("\nButun ikon ve favicon'lar basariyla olusturuldu ve guncellendi!")

if __name__ == '__main__':
    generate_icons()
