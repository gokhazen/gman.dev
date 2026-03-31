import os
import json
import re

def update_top_routes():
    # Dosya yolları
    routes_dir = './'
    config_file = '../kentkartinfo.json'
    
    if not os.path.exists(config_file):
        print(f"Hata: {config_file} bulunamadı.")
        return

    # Mevcut config'i oku
    with open(config_file, 'r', encoding='utf-8') as f:
        config_data = json.load(f)

    # Routes klasöründeki dosyaları gez
    for filename in os.listdir(routes_dir):
        if not filename.endswith('.json') or filename == 'update_routes.py':
            continue
            
        region_code = filename.replace('.json', '')
        file_path = os.path.join(routes_dir, filename)
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                # Bazı dosyalar çoklu JSON objesi içerebilir, satır satır veya tek seferde okumayı dene
                content = f.read().strip()
                # Kentkart formatı bazen geçersiz JSON olabiliyor ({...}{...})
                # Eğer direkt json.loads hata verirse düzeltmeye çalışalım
                try:
                    routes_raw = json.loads(content)
                except:
                    # Alternatif: Her satırda ayrı bir obje olabilir
                    lines = content.split('\n')
                    routes_raw = {}
                    for line in lines:
                        if line.strip():
                            obj = json.loads(line)
                            routes_raw.update(obj)
            
            # Hatları ve durak sayılarını hesapla
            route_lengths = {}
            for key, stops in routes_raw.items():
                # Key formatı: "100_0" -> route_id: "100"
                route_id = key.split('_')[0]
                stop_count = len(stops)
                
                # Aynı hattın farklı yönlerindeki en uzun olanı al
                if route_id not in route_lengths or stop_count > route_lengths[route_id]:
                    route_lengths[route_id] = stop_count
            
            # Uzunluğa göre sırala ve en uzun 15 tanesini al
            sorted_routes = sorted(route_lengths.items(), key=lambda x: x[1], reverse=True)
            top_15_routes = [route[0] for route in sorted_routes[:15]]
            
            # Config dosyasını güncelle
            if region_code in config_data['regions']:
                config_data['regions'][region_code]['routes'] = top_15_routes
                print(f"Güncellendi: {region_code} ({len(top_15_routes)} hat)")
            else:
                print(f"Uyarı: {region_code} config içerisinde bulunamadı.")
                
        except Exception as e:
            print(f"Hata ({filename}): {str(e)}")

    # Sonucu hazırla
    json_output = json.dumps(config_data, indent=2, ensure_ascii=False)
    
    # Regex ile [ ... ] içindeki listeleri tek satıra çek (Basit ve etkili)
    def compact_routes(match):
        # match.group(1) -> [ ... ] kısmını verir
        try:
            data = json.loads(match.group(1))
            return f'"routes": {json.dumps(data, ensure_ascii=False)}'
        except:
            return match.group(0) # Hata olursa dokunma

    json_output = re.sub(r'"routes":\s*(\[.*?\])', compact_routes, json_output, flags=re.DOTALL)

    with open(config_file, 'w', encoding='utf-8') as f:
        f.write(json_output)
        
    print("\nIslem tamamlandi: kentkartinfo.json guncellendi.")

if __name__ == "__main__":
    update_top_routes()
