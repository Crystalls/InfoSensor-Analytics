
from pymongo import MongoClient
from datetime import datetime
import time
import random


# ... (Настройки подключения)
MONGO_URI = "mongodb://localhost:27017/" 
DB_NAME = "newdb"



client = MongoClient(MONGO_URI)
db = client[DB_NAME]
COLLECTION_HISTORY = db["sensor_data_histories"]
COLLECTION_CURRENT = db["sensor_current_data"] # НОВАЯ КОЛЛЕКЦИЯ

SIMULATION_SCENARIOS = {
    # --- Инженер (Цех Б) ---
    "ENG_B_ENGINE_1_TEMP": {
        "sensor_id": "SNSR-001", 
        "sensor_type": "Датчик температуры",
        "role": "engineer",
        "wsection": "Цех №2",        # Уровень 1: Цех
        "asset": "Двигатель 1",      # Уровень 2: Объект
        "type": "temperature",
        "params": {"mean": 29.73, "std_dev": 1.0, "unit": "C"},
    },
    "ENG_B_ENGINE_1_PRESSURE": {
        "sensor_id": "SNSR-002", 
        "sensor_type": "Датчик давления",
        "role": "engineer",
        "wsection": "Цех №2",
        "asset": "Двигатель 1",      # То же самое, что и у температуры
        "type": "pressure",
        "params": {"mean": 3.0, "std_dev": 0.1, "unit": "Bar",
                   "thresholds": {"min": 2.5, "max": 4.0}},
    },
    # --- Инженер (Цех Б) - Другой объект ---
    "ENG_B_MACHINE_5_VIBRO": {
        "sensor_id": "SNSR-004", 
        "sensor_type": "Датчик вибрации",
        "role": "engineer",
        "wsection": "Цех №2",
        "asset": "Станок 5",         # Другой объект в том же цехе
        "type": "vibration",
        "params": {"mean": 0.8, "std_dev": 0.15, "unit": "mm/s"},
    },
    
    # --- Ученый (Поле А) ---
    "SCI_A_FIELD_A_MOISTURE": {
        "sensor_id": "SNSR-010",
        "sensor_type": "Датчик влажности",
        "role": "scientist",
        "wsection": "Поле А",
        "asset": "Почва",             # Объект для ученого
        "type": "moisture",
        "params": {"mean": 45.0, "std_dev": 5.0, "unit": "%"},
    },

    # Сценарий 4: Инженер 2 (Двигатель В) - Новый датчик вибрации
    "ENG_B_ENG_C_VIBRO": {
        "sensor_id": "SNSR-003", 
        "sensor_type": "Датчик вибрации",
        "role": "engineer",
        "wsection": "Цех №2",
        "asset": "Станок ЧПУ",         # Другой объект в том же цехе
        "params": {"mean": 0.8, "std_dev": 0.15, "unit": "мм/с"},
    },
    
    # Сценарий 5: Ученый (Поле А) - Температура
    "SCI_A_FIELD_A_TEMP": {
        "sensor_id": "SNSR-011",
        "sensor_type": "Датчик температуры",
        "role": "scientist",
        "wsection": "Поле А",
        "asset": "Почва",             # Объект для ученого
        "type": "temperature",
        "params": {"mean": 15.0, "std_dev": 1.5, "unit": "°C"},
    },
    
    # Сценарий 6: Ученый (Поле Г) - Новая локация
    "SCI_A_FIELD_G_LIGHT": {
        "sensor_id": "SNSR-022",
        "sensor_type": "Датчик освещенности",
        "role": "scientist",
        "wsection": "Поле Г",
        "type": "Датчик света",
        "params": {"mean": 80000, "std_dev": 5000, "unit": "Люкс"},
        },
    }



def get_simulated_value(mean, std_dev):
    # Используем стандартное нормальное распределение для реалистичности
    return round(random.gauss(mean, std_dev), 2)

def generate_and_store_data(scenarios):
    current_time = datetime.utcnow()
    
    for scenario_key, config in scenarios.items():
        params = config['params']
        
        # 1. Генерируем значение
        new_value = get_simulated_value(params['mean'], params['std_dev'])

        #  1. Запись в Коллекцию Истории 
        history_record = {
            "sensor_id": config['sensor_id'],
            "timestamp": current_time,
            "sensor_type": config['sensor_type'],
            "value": new_value,
            "unit": params['unit'],
            "role": config['role'],       # Роль привязывается к записи
            "wsection": config['wsection'], # Секция привязывается к записи
        }
        COLLECTION_HISTORY.insert_one(history_record)

        # --- 2. Запись/Обновление в Коллекцию Текущего Состояния ---
        current_record = {
            "sensor_id": config['sensor_id'],
            "value": new_value,
            "unit": params['unit'],
            "last_updated": current_time,
            "role": config['role'],
            "wsection": config['wsection'],
            "sensor_type": config['sensor_type'],
        }
        
        COLLECTION_CURRENT.update_one(
            {"sensor_id": config['sensor_id']},
            {"$set": current_record},
            upsert=True
        )


if __name__ == "__main__":
    while True:
        generate_and_store_data(SIMULATION_SCENARIOS)
        time.sleep(10) # Обновляем все данные каждые 10 секунд

