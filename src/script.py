
from pymongo import MongoClient, UpdateOne
from datetime import datetime
import time
import random
import uuid


# ... (Настройки подключения)
MONGO_URI = "mongodb://localhost:27017/" 
DB_NAME = "newdb"



client = MongoClient(MONGO_URI, uuidrepresentation="standard")
db = client[DB_NAME]
COLLECTION_HISTORY = "sensor_data_histories"
COLLECTION_CURRENT = "sensor_current_data"

SIMULATION_SCENARIOS = {
    # --- Сценарий для Инженера (Цех №2) ---
    "ENG_WORKSHOP2_ENGINE_1_TEMP": {
        "sensor_id": "SNSR-001", 
        "sensor_type": "Датчик температуры",
        "role": "engineer",
        "wsection": "Цех №2",        # Доступно инженеру в Цехе №2
        "asset": "Двигатель 1",      # Объект внутри Цеха №2
        "type": "temperature",
        "params": {"mean": 29.73, "std_dev": 6.0, "unit": "°C"},
    },
    "ENG_WORKSHOP2_ENGINE_1_PRESSURE": {
        "sensor_id": "SNSR-002", 
        "sensor_type": "Датчик давления",
        "role": "engineer",
        "wsection": "Цех №2",
        "asset": "Двигатель 1",      
        "type": "pressure",
        "params": {"mean": 3.0, "std_dev": 0.1, "unit": "Па",
                   "thresholds": {"min": 2.5, "max": 4.0}},
    },
    "ENG_WORKSHOP2_MACHINE_5_VIBRO": {
        "sensor_id": "SNSR-004", 
        "sensor_type": "Датчик вибрации",
        "role": "engineer",
        "wsection": "Цех №2",
        "asset": "Станок 5",         # Другой объект в Цехе №2
        "type": "vibration",
        "params": {"mean": 0.8, "std_dev": 0.15, "unit": "мм/с"},
    },
    
    # --- Сценарий для Ученого (Поле А) ---
    "SCI_A_FIELD_A_MOISTURE": {
        "sensor_id": "SNSR-010",
        "sensor_type": "Датчик влажности",
        "role": "scientist",
        "wsection": "Поле А",
        "asset": "Почва (Сектор 1)",  # Объект внутри Поля А
        "type": "moisture",
        "params": {"mean": 45.0, "std_dev": 5.0, "unit": "%"},
    },
        # --- Сценарий для Инженера (Цех №1) ---
    "ENG_WORKSHOP1_PUMP_1_TEMP": {
        "sensor_id": "SNSR-0231", 
        "sensor_type": "Датчик температуры",
        "role": "engineer",
        "wsection": "Цех №1",        # Доступно инженеру в Цехе №2
        "asset": "Насосная станция",      # Объект внутри Цеха №2
        "type": "temperature",
        "params": {"mean": 29.73, "std_dev": 1.0, "unit": "°C"},
    },
    "ENG_WORKSHOP1_TURNING MACHINE_1_PRESSURE": {
        "sensor_id": "SNSR-0202", 
        "sensor_type": "Датчик давления",
        "role": "engineer",
        "wsection": "Цех №1",
        "asset": "Токарный станок",      
        "type": "pressure",
        "params": {"mean": 3.0, "std_dev": 0.1, "unit": "Па",
                   "thresholds": {"min": 2.5, "max": 4.0}},
    },
    "ENG_WORKSHOP1_CNC_MACHINE_1_VIBRO": {
        "sensor_id": "SNSR-01304", 
        "sensor_type": "Датчик вибрации",
        "role": "engineer",
        "wsection": "Цех №1",
        "asset": "Станок ЧПУ",         # Другой объект в Цехе №2
        "type": "vibration",
        "params": {"mean": 0.8, "std_dev": 0.15, "unit": "мм/с"},
    },
        "ENG_WORKSHOP2_LIQUID_1_": {
        "sensor_id": "SNSR-01304", 
        "sensor_type": "Датчик уровня жидкости",
        "role": "engineer",
        "wsection": "Цех №1",
        "asset": "Станок 5",         # Другой объект в Цехе №2
        "type": "luquid",
        "params": {"mean": 890, "std_dev": 36, "unit": "мл"},
    },
}

# --- ФУНКЦИИ ---

def get_simulated_value(mean, std_dev):
    return round(random.gauss(mean, std_dev), 2)

def generate_and_store_data(scenarios):
    current_time = datetime.utcnow()
    
    history_bulk_ops = []
    current_bulk_ops = []

    for scenario_key, config in scenarios.items():
        params = config['params']
        new_value = get_simulated_value(params['mean'], params['std_dev'])

        # 1. Запись в Коллекцию Истории
        history_record = {
            "_id": uuid.uuid4(),  # Генерация нового UUID для каждой записи истории
            "sensor_id": config['sensor_id'],
            "timestamp": current_time,
            "sensor_type": config['sensor_type'],
            "historicalvalue": new_value,
            "unit": params['unit'],
            "role": config['role'],       
            "wsection": config['wsection'], # СОХРАНЯЕМ КОНТЕКСТ
            "asset": config['asset'],       # СОХРАНЯЕМ КОНТЕКСТ
        }
        history_bulk_ops.append(UpdateOne(
            {"_id": history_record["_id"]}, # Используем сгенерированный UUID как _id
            {"$set": history_record},
            upsert=True
        ))

        # 2. Запись/Обновление в Коллекцию Текущего Состояния
        current_record = {
            "sensor_id": config['sensor_id'],
            "value": new_value,
            "unit": params['unit'],
            "last_updated": current_time,
            "role": config['role'],
            "wsection": config['wsection'],
            "asset": config['asset'],
            "sensor_type": config['sensor_type'],

        }
        
        current_bulk_ops.append(UpdateOne(
            {"sensor_id": config['sensor_id']}, 
            {"$set": current_record},
            upsert=True
        ))

    if history_bulk_ops:
        db[COLLECTION_HISTORY].bulk_write(history_bulk_ops, ordered=False)
    if current_bulk_ops:
        db[COLLECTION_CURRENT].bulk_write(current_bulk_ops, ordered=False)
        
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Stored data for {len(scenarios)} scenarios.")


if __name__ == "__main__":
    print("Starting hierarchical data simulation...")
    while True:
        generate_and_store_data(SIMULATION_SCENARIOS)
        time.sleep(10)

