import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom' // Импортируем хуки
import axios from 'axios'
import ThresholdConfigEditor from './ThresholdConfigEditor'
import { API_BASE_URL } from '../../services/api'

const AssetDetailView = ({ token }) => {
  const { assetName } = useParams()
  const navigate = useNavigate()

  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Новый стейт для хранения всех порогов по типу
  const [thresholdsByTypeMap, setThresholdsByTypeMap] = useState({})

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)

  // 1. ФУНКЦИЯ ЗАГРУЗКИ ПОРОГОВ ПО ТИПУ
  const fetchThresholdsByType = useCallback(async () => {
    if (!token) return {}
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      const response = await axios.get(`${API_BASE_URL}/api/thresholds-by-type`, config)
      const map = response.data.thresholdMap || {}
      setThresholdsByTypeMap(map)
      return map
    } catch (err) {
      console.error('Error fetching thresholds by type:', err)
      return {}
    }
  }, [token])

  const fetchDetails = useCallback(async () => {
    if (!token) {
      setError('Авторизационный токен отсутствует.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }

      // Запускаем оба запроса параллельно
      const [detailsResponse, thresholdsMap] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/assets/${assetName}`, config),
        fetchThresholdsByType(), // Используем функцию для получения порогов
      ])

      const detailsData = detailsResponse.data

      // 2. ОБЪЕДИНЯЕМ ДАННЫЕ СЕНСОРОВ И ПОРОГОВ
      if (detailsData.sensors && Array.isArray(detailsData.sensors)) {
        detailsData.sensors = detailsData.sensors.map((sensor) => {
          const type = sensor.type
          const thresholds = thresholdsMap[type]

          if (thresholds) {
            return {
              ...sensor,
              // Добавляем новые поля min/max для отображения и редактирования
              min_value: thresholds.min_value,
              max_value: thresholds.max_value,
            }
          }
          return { ...sensor, min_value: 'N/A', max_value: 'N/A' } // Если порог не найден
        })
      }

      setDetails(detailsData)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching asset details:', err)
      if (err.response && err.response.status === 403) {
        setError('У вас нет прав доступа к этому активу.')
      } else {
        setError(`Не удалось загрузить детали для ${assetName}.`)
      }
      setLoading(false)
    }
  }, [assetName, token, fetchThresholdsByType])

  // Запускаем fetchDetails, который теперь сам вызывает fetchThresholdsByType
  useEffect(() => {
    fetchDetails()
  }, [fetchDetails])

  // ... (Обработка loading/error/no details остается прежней) ...

  if (loading) return <div className='container mt-4'>Загрузка деталей актива "{assetName}"...</div>
  if (error)
    return (
      <div className='container mt-4'>
        <div className='alert alert-danger'>{error}</div>
        <button
          className='btn btn-secondary'
          onClick={() => navigate('/assets')}
        >
          Вернуться к реестру
        </button>
      </div>
    )
  if (!details) return <div className='container mt-4'>Данные по активу не найдены.</div>

  // --- РЕНДЕРИНГ ДЕТАЛЕЙ ---
  return (
    <div className='container mt-4'>
      <button
        className='btn btn-outline-secondary mb-3'
        onClick={() => navigate('/assets')}
      >
        &larr; Вернуться к реестру
      </button>

      <h1>Детали Актива: {details.name || assetName}</h1>

      {/* ... (Общая Информация остается прежней) ... */}

      <div className='card mb-4'>
        <div className='card-header bg-primary text-white'>
          <h4>Общая информация</h4>
        </div>
        <div className='card-body'>
          <p>
            <strong>Цех:</strong> {details.workshop}
          </p>
          <p>
            <strong>Статус:</strong> <span className={details.statusColor}>{details.status}</span>
          </p>
          <p>
            <strong>Ответственный рабочий:</strong> {details.responsibleWorker || 'Не назначен'}
          </p>
          <hr />
        </div>
      </div>

      <div className='card mb-4'>
        <div className='card-header bg-info text-dark'>
          <h4>Привязанные датчики</h4>
        </div>
        <ul className='list-group list-group-flush'>
          {details.sensors &&
            details.sensors.map((sensor, index) => (
              <li
                key={index}
                className='list-group-item d-flex justify-content-between align-items-center'
              >
                {/* ЛЕВАЯ ЧАСТЬ: Тип и ID */}
                <div>
                  <strong>{sensor.type}</strong> (ID: {sensor.sensorId}){/* ВЫВОД АКТУАЛЬНЫХ ДАННЫХ */}
                  <div
                    className='text-unmuted'
                    style={{ fontSize: '0.9em' }}
                  >
                    Значение: <span className={sensor.statusColor}>{sensor.currentValue}</span>
                    {sensor.unit && <span> {sensor.unit}</span>}
                    {sensor.timestamp && <span> | Обновлено: {sensor.timestamp}</span>}
                  </div>
                </div>

                {/* ПРАВАЯ ЧАСТЬ: Пороги и Статус */}
                <div className='text-end'>
                  <span className='d-block mb-1'>
                    <span className={`badge bg-secondary rounded-pill`}>
                      Порог: {sensor.min_value} - {sensor.max_value}
                    </span>
                  </span>
                  <span className={`badge ${sensor.status === 'Тревога' ? 'bg-danger' : 'bg-success'} rounded-pill`}>
                    {sensor.status}
                  </span>
                </div>
              </li>
            ))}
        </ul>
      </div>

      {/* --- КНОПКИ ДЕЙСТВИЙ --- */}
      <button
        className='btn btn-warning me-2'
        onClick={() => setIsConfigModalOpen(true)}
      >
        Редактировать Конфигурацию
      </button>
      <button className='btn btn-secondary'>Управление Ремонтом</button>

      {/* --- МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ --- */}
      {isConfigModalOpen && (
        <ThresholdConfigEditor
          assetName={assetName}
          token={token}
          // 4. ПЕРЕДАЕМ ОБНОВЛЕННЫЕ ДАННЫЕ В РЕДАКТОР
          initialConfigs={details.sensors.map((s) => ({
            sensorId: s.sensorId,
            type: s.type,
            // Передаем min/max для редактирования
            min_value: s.min_value === 'N/A' ? 0 : s.min_value,
            max_value: s.max_value === 'N/A' ? 0 : s.max_value,
            // Сохраняем type для ключа в БД
            sensor_type: s.type,
          }))}
          onClose={(isSaved) => {
            setIsConfigModalOpen(false)
            if (isSaved) {
              fetchDetails() // Перезагружаем данные после сохранения
            }
          }}
        />
      )}
    </div>
  )
}

export default AssetDetailView
