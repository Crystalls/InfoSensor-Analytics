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

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)

  const fetchDetails = useCallback(async () => {
    if (!token) {
      setError('Авторизационный токен отсутствует.')
      setLoading(false)
      return
    }

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }

      // 1. Получаем детали актива (включая сводный статус и последнее чтение)
      const response = await axios.get(`${API_BASE_URL}/api/assets/${assetName}`, config)

      setDetails(response.data)
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
  }, [assetName, token])

  useEffect(() => {
    fetchDetails()
  }, [fetchDetails])

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

      <div className='card mb-4'>
        <div className='card-header bg-primary text-white'>
          <h4>Общая Информация</h4>
        </div>
        <div className='card-body'>
          <p>
            <strong>Цех:</strong> {details.workshop}
          </p>
          <p>
            <strong>Статус:</strong> <span className={details.statusColor}>{details.status}</span>
          </p>
          <p>
            <strong>Ответственный инженер:</strong> {details.responsibleEngineer || 'Не назначен'}
          </p>
          <hr />
          <p>
            <strong>Текущее Состояние:</strong> {details.lastValue} ({details.timestamp})
          </p>
        </div>
      </div>

      <div className='card mb-4'>
        <div className='card-header bg-info text-dark'>
          <h4>Привязанные Сенсоры</h4>
        </div>
        <ul className='list-group list-group-flush'>
          {details.sensors &&
            details.sensors.map((sensor, index) => (
              <li
                key={index}
                className='list-group-item d-flex justify-content-between align-items-center'
              >
                {sensor.type} (ID: {sensor.sensorId})
                <span className={`badge bg-secondary rounded-pill`}>Порог: {sensor.threshold}</span>
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
          initialConfigs={details.sensors.map((s) => ({
            sensorId: s.sensorId,
            type: s.type,
            threshold: s.threshold === 'N/A' ? 0 : s.threshold,
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
