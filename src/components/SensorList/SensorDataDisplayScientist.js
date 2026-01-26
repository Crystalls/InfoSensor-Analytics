import React, { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../services/api' // Убедитесь, что путь правильный
import AlertValue from '../AlertList/AlertList'
import '../SensorList/SensorList.css'

function SensorDataDisplayScientist() {
  const [sensorData, setSensorData] = useState([])
  const [groupedData, setGroupedData] = useState({})
  const [expandedItems, setExpandedItems] = useState({})
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [thresholdsByTypeMap, setThresholdsByTypeMap] = useState({})
  const intervalRef = useRef(null)

  // Ref для хранения актуальных порогов (для стабилизации функций)
  const thresholdsRef = useRef(thresholdsByTypeMap)

  // Эффект для синхронизации Ref
  useEffect(() => {
    // Этот эффект запускается при каждом обновлении порогов и сохраняет их в Ref
    thresholdsRef.current = thresholdsByTypeMap
  }, [thresholdsByTypeMap])

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (Используют Ref и теперь стабильны) ---

  const checkSensorError = useCallback((sensor) => {
    const currentThresholds = thresholdsRef.current
    if (!sensor || !sensor.sensor_type || sensor.value === undefined || !currentThresholds[sensor.sensor_type])
      return false

    const thresholdConfig = currentThresholds[sensor.sensor_type]
    const value = sensor.value
    const lowerCaseType = sensor.sensor_type.toLowerCase()

    // 1. Проверка полной структуры min/max
    if (thresholdConfig.min_value !== undefined && thresholdConfig.max_value !== undefined) {
      if (lowerCaseType.includes('кислот')) {
        return value < thresholdConfig.min_value || value > thresholdConfig.max_value
      } else if (lowerCaseType.includes('температур')) {
        return value < thresholdConfig.min_value || value > thresholdConfig.max_value
      }
    }

    // 2. Проверка max_value
    const alertValue = thresholdConfig.max_value
    if (alertValue !== undefined) {
      if (lowerCaseType.includes('солен') || lowerCaseType.includes('влажн') || lowerCaseType.includes('углекисл')) {
        return value > alertValue
      }
      // Проверка уровня
      if (lowerCaseType.includes('уровня')) {
        return value < thresholdConfig.min_value
      }
    }
    return false
  }, []) // <-- Зависимости пусты, так как читаем из Ref

  const getAlertMessage = useCallback((sensor) => {
    const currentThresholds = thresholdsRef.current
    if (!sensor || !sensor.sensor_type || sensor.value === undefined || !currentThresholds[sensor.sensor_type])
      return ''

    const thresholdConfig = currentThresholds[sensor.sensor_type]
    const lowerCaseType = sensor.sensor_type.toLowerCase()
    const value = sensor.value

    // Убеждаемся, что у нас есть хотя бы одно пороговое значение
    if (thresholdConfig.max_value === undefined) {
      return ''
    }

    const minThreshold = thresholdConfig.min_value // Теперь должно быть 0 или число
    const maxThreshold = thresholdConfig.max_value // 46 для температуры

    // 1. ЛОГИКА ДЛЯ ДАВЛЕНИЯ (Требуется диапазон)
    if (lowerCaseType.includes('кислот')) {
      if (value < minThreshold)
        return `Кислотность почвы ниже порогового значения (${minThreshold} ${sensor.unit || ''}) ${value} ${
          sensor.unit || ''
        }`
      if (value > maxThreshold)
        return `Превышены пороговые значения кислотности почвы (${maxThreshold} ${sensor.unit || ''}) ${value} ${
          sensor.unit || ''
        }`
    } else if (lowerCaseType.includes('температур')) {
      if (value < minThreshold)
        return `Температура почвы ниже порогового значения (${minThreshold} ${sensor.unit || ''}) ${value} ${
          sensor.unit || ''
        }`
      if (value > maxThreshold)
        return `Превышены пороговые значения температуры почвы (${maxThreshold} ${sensor.unit || ''}) ${value} ${
          sensor.unit || ''
        }`
    }

    // 2. ЛОГИКА ДЛЯ ТЕМПЕРАТУРЫ, ВИБРАЦИИ (Только верхний предел)
    else if (lowerCaseType.includes('солен') || lowerCaseType.includes('углекисл') || lowerCaseType.includes('влажн')) {
      if (value > maxThreshold)
        return `Превышены пороговые значения (${maxThreshold} ${sensor.unit || ''}) ${value} ${sensor.unit || ''}`
    }

    // 3. ЛОГИКА ДЛЯ УРОВНЯ (Только нижний предел)
    else if (lowerCaseType.includes('уровня')) {
      if (value < minThreshold)
        return `Низкий уровень жидкости (${minThreshold} ${sensor.unit || ''}) ${value} ${sensor.unit || ''}`
    }

    return '' // Нет тревоги
  }, [])

  const getAlertThresholdForAlertValue = useCallback((sensor) => {
    const currentThresholds = thresholdsRef.current
    if (!sensor || !sensor.sensor_type || !currentThresholds[sensor.sensor_type]) return { min: 0, max: 200 }
    const config = currentThresholds[sensor.sensor_type]
    if (config.min_value !== undefined && config.max_value !== undefined) {
      return { min: config.min_value, max: config.max_value }
    }
    if (config.max_value !== undefined) {
      return { min: 0, max: config.max_value }
    }
    return { min: 0, max: 200 }
  }, [])

  // --- ГРУППИРОВКА И РАСКРЫТИЕ ---

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

  const toggleItemExpand = (level, sectionName, assetName, sensorId) => {
    setExpandedItems((prev) => {
      const newPrev = { ...prev }
      if (level === 'ASSET') {
        newPrev[sectionName] = { ...newPrev[sectionName], [assetName]: !newPrev[sectionName]?.[assetName] }
      } else if (level === 'SENSOR' && sensorId) {
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

  // --- ЗАГРУЗКА И ИНТЕРВАЛ (СТАБИЛЬНО) ---

  const fetchAllThresholdsByType = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      const response = await axios.get(`${API_BASE_URL}/api/thresholds-by-type`, config)
      setThresholdsByTypeMap(response.data.thresholdMap || {})
    } catch (err) {
      console.error('Failed to load global thresholds by type:', err)
    }
  }, [])

  const fetchSensorData = useCallback(async () => {
    const token = localStorage.getItem('token')
    setError('')
    try {
      if (!token) throw new Error('Authentication token is missing')
      const response = await axios.get(`${API_BASE_URL}/api/sensor-data`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const initialData = response.data.filter(
        (data) => data && data.sensor_type && data.wsection && data.asset && data.value !== undefined,
      )
      const dataWithErrorFlags = initialData.map((data) => ({
        ...data,
        isExpanded: false,
        hasError: checkSensorError(data), // Использует стабильный checkSensorError
      }))

      setSensorData(dataWithErrorFlags)
      setGroupedData(groupDataByAsset(dataWithErrorFlags))
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch sensor data')
      console.error('Error fetching sensor data:', err)
    } finally {
      setLoading(false)
    }
  }, [checkSensorError]) // Зависит от checkSensorError (который стабилен)

  useEffect(() => {
    // Первая загрузка
    fetchAllThresholdsByType()
    fetchSensorData()

    // Создание интервала (должно быть стабильным)
    intervalRef.current = setInterval(() => {
      fetchSensorData()
    }, 5000)

    // Очистка при размонтировании (при переходе на другую страницу)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchSensorData, fetchAllThresholdsByType]) // Эти функции стабильны

  // --- РЕНДЕРИНГ КОМПОНЕНТА ---

  if (isLoading && Object.keys(groupedData).length === 0) {
    return <p>Загрузка показаний датчиков...</p>
  }

  if (error) {
    return <p style={{ color: 'red' }}>Ошибка: {error}</p>
  }

  const sectionKeys = groupedData ? Object.keys(groupedData) : []

  return (
    <div className='flex_sensor_container'>
      <div className='sensor_container'>
        <div className='text_sensors'>
          <h2>
            Показания <br /> Датчиков
          </h2>
        </div>
        <div>
          {sectionKeys.length > 0 ? (
            <div className='hierarchical-dashboard'>
              {sectionKeys.map((sectionName) => {
                const assetKeys = groupedData[sectionName] ? Object.keys(groupedData[sectionName]) : []

                return (
                  <div
                    key={sectionName}
                    className='section-block'
                  >
                    <h3
                      onClick={() => toggleItemExpand('ASSET', sectionName, null)}
                      style={{ cursor: 'pointer' }}
                    >
                      Рабочий сектор: {sectionName}
                    </h3>

                    {expandedItems[sectionName] &&
                      assetKeys.map((assetName) => (
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

                          {expandedItems[sectionName]?.[assetName] && (
                            <div className='sensor-list-container'>
                              {groupedData[sectionName][assetName].map((data) => {
                                const alertMessage = getAlertMessage(data)
                                const alertThresholdOrRange = getAlertThresholdForAlertValue(data)
                                const isDetailExpanded = expandedItems[sectionName]?.[assetName]?.[data.sensor_id]

                                return (
                                  <div
                                    key={data.sensor_id + data.timestamp}
                                    className={`
                                                                    container_data
                                                                    ${isDetailExpanded ? 'expanded' : ''}
                                                                    ${data.hasError ? 'sensor-error' : ''}
                                                                `}
                                  >
                                    <li className='sensor-item'>
                                      <div
                                        className='sensor-header'
                                        onClick={() =>
                                          toggleItemExpand('SENSOR', sectionName, assetName, data.sensor_id)
                                        }
                                      >
                                        {/* ВОССТАНОВЛЕННЫЙ ТЕГ: h1 для стилей */}
                                        <p className='title'>
                                          ID Датчика: {data.sensor_id}
                                          <br></br>
                                          ТИП: {data.sensor_type}
                                        </p>
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
                                            Показатели:
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
                )
              })}
            </div>
          ) : (
            <p>Нету данных датчиков доступных для вашего уровня доступа.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default SensorDataDisplayScientist
