import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../services/api' // Assuming you have an API base URL
import AlertValue from '../AlertList/AlertList'
import '../SensorList/SensorList.css'

function SensorDataDisplayEngineer() {
  // sensorData: Полный массив данных (используется для метаданных ошибок и деталей при раскрытии)
  const [sensorData, setSensorData] = useState([])
  // groupedData: Сгруппированные данные (Цех -> Актив -> Список датчиков)
  const [groupedData, setGroupedData] = useState({})
  // expandedItems: Управляет раскрытием Asset И Sensor Details, используя вложенную структуру
  const [expandedItems, setExpandedItems] = useState({})
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // --- ПОРОГИ ---
  const temperatureThreshold = 45
  const humidityThreshold = 65
  const minPascalThreshold = 0.7
  const maxPascalThreshold = 3.5
  // ----------------

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (Проверки состояния) ---

  const checkSensorError = useCallback(
    (sensor) => {
      if (!sensor || !sensor.sensor_type || typeof sensor.sensor_type !== 'string' || sensor.value === undefined) {
        return false
      }
      const lowerCaseType = sensor.sensor_type.toLowerCase()

      if (lowerCaseType.includes('температур')) {
        return sensor.value > temperatureThreshold
      } else if (lowerCaseType.includes('влажн')) {
        return sensor.value > humidityThreshold
      } else if (lowerCaseType.includes('давл')) {
        return sensor.value < minPascalThreshold || sensor.value > maxPascalThreshold
      }
      return false
    },
    [temperatureThreshold, humidityThreshold, minPascalThreshold, maxPascalThreshold],
  )

  const getAlertMessage = useCallback(
    (sensor) => {
      if (!sensor || !sensor.sensor_type || sensor.value === undefined) return ''
      const lowerCaseType = sensor.sensor_type.toLowerCase()
      const value = sensor.value

      if (lowerCaseType.includes('температур') && value > temperatureThreshold)
        return `Превышены пороговые значения температуры (${temperatureThreshold} °C)`
      if (lowerCaseType.includes('влажн') && value > humidityThreshold)
        return `Превышены пороговые значения влажности (${humidityThreshold} %)`
      if (lowerCaseType.includes('давл')) {
        if (value < minPascalThreshold) return `Давление ниже порогового значения (${minPascalThreshold} Па)`
        if (value > maxPascalThreshold) return `Превышены пороговые значения давления (${maxPascalThreshold} Па)`
      }
      return ''
    },
    [temperatureThreshold, humidityThreshold, minPascalThreshold, maxPascalThreshold],
  )

  const getAlertThresholdForAlertValue = useCallback(
    (sensor) => {
      if (!sensor || !sensor.sensor_type) return 200
      const lowerCaseType = sensor.sensor_type.toLowerCase()
      if (lowerCaseType.includes('температур')) return temperatureThreshold
      if (lowerCaseType.includes('влажн')) return humidityThreshold
      if (lowerCaseType.includes('давл')) {
        return { min: minPascalThreshold, max: maxPascalThreshold }
      }
      return 200
    },
    [temperatureThreshold, humidityThreshold, minPascalThreshold, maxPascalThreshold],
  )

  // --- ФУНКЦИЯ ГРУППИРОВКИ (Остается прежней) ---
  const groupDataByAsset = (dataArray) => {
    const grouped = {}
    dataArray.forEach((sensor) => {
      const section = sensor.wsection
      const asset = sensor.asset

      if (!section || !asset) return

      if (!grouped[section]) grouped[section] = {}
      if (!grouped[section][asset]) grouped[section][asset] = []

      grouped[section][asset].push(sensor)
    })
    return grouped
  }

  // --- ОБНОВЛЕННЫЙ ОБРАБОТЧИК РАСКРЫТИЯ (Единый для Asset и Sensor) ---
  const toggleItemExpand = (level, sectionName, assetName, sensorId) => {
    setExpandedItems((prev) => {
      const newPrev = { ...prev }

      if (level === 'ASSET') {
        // Раскрытие/Скрытие Объекта
        newPrev[sectionName] = {
          ...newPrev[sectionName],
          [assetName]: !newPrev[sectionName]?.[assetName],
        }
      } else if (level === 'SENSOR' && sensorId) {
        // Раскрытие/Скрытие Деталей Датчика
        newPrev[sectionName] = {
          ...newPrev[sectionName],
          [assetName]: {
            ...newPrev[sectionName]?.[assetName],
            [sensorId]: !newPrev[sectionName]?.[assetName]?.[sensorId],
          },
        }
      }
      return newPrev
    })
  }

  // --- ЗАГРУЗКА ДАННЫХ ---
  useEffect(() => {
    const fetchSensorData = async () => {
      setLoading(true)
      setError('')
      try {
        const token = localStorage.getItem('token')
        if (!token) throw new Error('Token missing')

        const response = await axios.get(`${API_BASE_URL}/sensor-data`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        // Фильтруем на основе полей, которые должны быть в 'current_data'
        const initialData = response.data.filter(
          (data) => data && data.sensor_type && data.wsection && data.asset && data.value !== undefined,
        )

        // Добавляем флаги ошибок и isExpanded (для деталей).
        // isExpanded по умолчанию false, т.к. детали не раскрыты.
        const dataWithErrorFlags = initialData.map((data) => ({
          ...data,
          isExpanded: false,
          hasError: checkSensorError(data),
        }))

        setSensorData(dataWithErrorFlags) // Полный список (для поиска деталей при раскрытии)

        // Группируем (если бэкенд вернул несколько одинаковых записей, они попадут в массив)
        const groups = groupDataByAsset(dataWithErrorFlags)
        setGroupedData(groups)
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch sensor data')
        console.error('Error fetching sensor data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSensorData()
  }, [])

  // --- РЕНДЕРИНГ ---

  if (isLoading) return <p>Loading sensor data...</p>
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>

  return (
    <div className='flex_sensor_container'>
      <div className='sensor_container'>
        <div className='text_sensors'>
          <h2>
            Sensor <br /> Data
          </h2>
        </div>
        <div>
          {Object.keys(groupedData).length > 0 ? (
            <div className='hierarchical-dashboard'>
              {/* Итерация по ЦЕХАМ (WSection) */}
              {Object.keys(groupedData).map((sectionName) => (
                <div
                  key={sectionName}
                  className='section-block'
                >
                  <h3
                    onClick={() => toggleItemExpand('ASSET', sectionName, null)}
                    style={{ cursor: 'pointer' }}
                  >
                    Цех: {sectionName}
                  </h3>

                  {/* Итерация по ОБЪЕКТАМ/АСCЕТАМ */}
                  {Object.keys(groupedData[sectionName]).map((assetName) => (
                    <div
                      key={assetName}
                      className='asset-block'
                    >
                      <div
                        className='asset-header'
                        onClick={() => toggleItemExpand('ASSET', sectionName, assetName, null)}
                        style={{ cursor: 'pointer' }}
                      >
                        <h4>Объект: {assetName}</h4>
                        <span className={`arrow ${expandedItems[sectionName]?.[assetName] ? 'up' : 'down'}`}></span>
                      </div>

                      {/* Раскрытие Объекта (Asset) */}
                      {expandedItems[sectionName]?.[assetName] && (
                        <div className='sensor-list-container'>
                          {groupedData[sectionName][assetName].map((data) => {
                            const alertMessage = getAlertMessage(data)
                            const alertThresholdOrRange = getAlertThresholdForAlertValue(data)

                            // Получаем состояние раскрытия деталей из нового стейта (expandedItems)
                            const isDetailExpanded = expandedItems[sectionName]?.[assetName]?.[data.sensor_id]

                            return (
                              <div
                                key={data._id || data.sensor_id}
                                className={`
                                                                    container_data
                                                                    ${isDetailExpanded ? 'expanded' : ''}
                                                                    ${data.hasError ? 'sensor-error' : ''}
                                                                `}
                              >
                                <li className='sensor-item'>
                                  <div
                                    className='sensor-header'
                                    // Теперь переключаем детали датчика через toggleItemExpand
                                    onClick={() => toggleItemExpand('SENSOR', sectionName, assetName, data.sensor_id)}
                                  >
                                    <h1 className='title'>
                                      ID Датчика: {data.sensor_id}
                                      <br></br>
                                      Тип: {data.sensor_type}
                                    </h1>
                                    {data.hasError && (
                                      <span
                                        className='error-indicator'
                                        title={alertMessage}
                                      >
                                        !
                                      </span>
                                    )}
                                    <span className={`arrow ${isDetailExpanded ? 'up' : 'down'}`}></span>
                                  </div>

                                  {isDetailExpanded && (
                                    <div className='sensor-details'>
                                      Тип: {data.sensor_type.toLowerCase()}
                                      <br></br>
                                      <div className='data_info'>
                                        Показатели:&nbsp;
                                        <AlertValue
                                          sensorType={data.sensor_type}
                                          value={data.value}
                                          alertThreshold={alertThresholdOrRange}
                                          alertMessage={alertMessage}
                                          unit={data.unit}
                                        />
                                      </div>
                                      Дата замера: {new Date(data.last_updated).toLocaleString()}
                                    </div>
                                  )}
                                </li>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p>No sensor data available for your access level.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default SensorDataDisplayEngineer
