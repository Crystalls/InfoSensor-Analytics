import pymongo
import random
import time
from datetime import datetime

# --- Конфигурация MongoDB ---
MONGO_URI = "mongodb://localhost:27017/" # Адрес вашей MongoDB
DB_NAME = "newdb"             # Имя базы данных
COLLECTION_NAME = "sensor_current_data" # Имя коллекции

# --- Конфигурация датчиков ---
# Список словарей, каждый из которых описывает один датчик
sensors_config = [
    {
        "id": "SNSR-001",
        "type": "temperature",
        "unit": "C",
        "role": "engineer",
        "wsection": "Двигатель Б",
        "min_val": 15.0,
        "max_val": 30.0,
        "current_val": 20.0,  # Начальное значение
        "change_range": (-2.5, 15) # Максимальное изменение за шаг
    },
    {
        "id": "SNSR-045",
        "type": "humidity",
        "unit": "%",
        "role": "engineer",
        "wsection": "Двигатель Б",
        "min_val": 40.0,
        "max_val": 90.0,
        "current_val": 60.0,  # Начальное значение
        "change_range": (-1.5, 1.5) # Максимальное изменение за шаг
    },
    {
        "id": "SNSR-0252",
        "type": "pressure",
        "unit": "Па",
        "role": "engineer",
        "wsection": "Двигатель Б",
        "min_val": 0.7,
        "max_val": 2.0,
        "current_val": 1.0, # Начальное значение
        "change_range": (-0.4, 0.8) # Максимальное изменение за шаг
    },
    # Можно добавить больше датчиков, например, для другого местоположения
    {
        "id": "sensor_004_temp_field2",
        "type": "temperature",
        "unit": "Celsius",
        "min_val": 10.0,
        "max_val": 35.0,
        "current_val": 22.0,
        "change_range": (-0.8, 0.8)
    }
]

send_interval_sec = 2

# --- Функции ---

def generate_value(min_val, max_val, change_range):
    """
    Генерирует новое значение. В этом режиме мы генерируем его
    абсолютно случайно в заданном диапазоне, а не на основе предыдущего.
    Если нужно сохранять "дрейф", нам придётся читать предыдущее значение из DB.
    """
    # Здесь мы генерируем случайное значение в рамках минимума/максимума
    # Если нужен дрейф, нужно добавить чтение из DB, см. ниже.
    return random.uniform(min_val, max_val)


def update_data_in_mongo(sensor_id, sensor_type, sensor_unit, new_value):
    """
    Обновляет (или вставляет, если нет) запись в MongoDB по sensor_id.
    """
    try:
        client = pymongo.MongoClient(MONGO_URI)
        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]
        
        # Фильтр: ищем документ по sensor_id
        filter_query = {"sensor_id": sensor_id}
        
        # Обновление: используем $set для изменения полей и $currentDate для метки времени
        update_query = {
            "$set": {
                "value": round(new_value, 2),
                "type": sensor_type,
                "unit": sensor_unit,
                "timestamp": datetime.utcnow() # Время последнего обновления
            },
            "$currentDate": {
                "last_updated": True # Автоматически проставит текущее время в UTC
            }
        }
        
        # Выполняем обновление. upsert=True гарантирует, что запись будет создана, если не найдена
        result = collection.update_one(filter_query, update_query, upsert=True)
        
        # Вывод информации о результате
        if result.upserted_id:
            print(f"СОЗДАНА новая запись для {sensor_id} (ID: {result.upserted_id})")
        elif result.modified_count > 0:
            print(f"ОБНОВЛЕНА запись для {sensor_id}")
        
        client.close()
        
    except Exception as e:
        print(f"Произошла ошибка при обновлении данных для {sensor_id}: {e}")

# --- Главный цикл ---

if __name__ == "__main__":
    print(f"Начинаем имитацию датчиков. Обновление данных каждые {send_interval_sec} секунд.")
    print(f"Подключение к MongoDB: {MONGO_URI}, БД: {DB_NAME}, Коллекция: {COLLECTION_NAME}")

    while True:
        for sensor_conf in sensors_config:
            
            # Генерируем новое значение для текущего датчика
            new_value = generate_value(
                sensor_conf["min_val"], 
                sensor_conf["max_val"], 
                sensor_conf["change_range"]
            )
            
            update_data_in_mongo(
                sensor_id=sensor_conf["id"],
                sensor_type=sensor_conf["type"],
                sensor_unit=sensor_conf["unit"],
                new_value=new_value
            )
        
        print("-" * 20)
        time.sleep(send_interval_sec)