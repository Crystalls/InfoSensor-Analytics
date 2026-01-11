import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../services/api'
import moment from 'moment'
import 'moment/locale/ru'

const NotificationCenter = ({ token, user }) => {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // --- ФУНКЦИИ ДЕЙСТВИЙ (перенесены из Dropdown) ---

  const markAsRead = async (id) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      await axios.put(`${API_BASE_URL}/api/alerts/${id}/read`, {}, config)
      // Обновляем список, но не через fetchAlerts, а через локальное обновление
      setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, isRead: true } : a)))
    } catch (error) {
      console.error('Failed to mark alert as read:', error)
    }
  }

  const resolveAlert = async (id) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      // Внимание: resolvedBy должен быть именем пользователя, который решает тревогу
      await axios.put(`${API_BASE_URL}/api/alerts/${id}/resolve`, { resolvedBy: user.name || 'Admin' }, config)
      // При успешном решении удаляем из списка или помечаем
      setAlerts((prev) => prev.filter((a) => a._id !== id))
      // Если хотим оставить, но пометить:
      // setAlerts(prev => prev.map(a => a._id === id ? { ...a, resolvedBy: user.name } : a));
    } catch (error) {
      console.error('Failed to resolve alert:', error)
    }
  }

  // --- ФУНКЦИЯ ЗАГРУЗКИ ВСЕХ УВЕДОМЛЕНИЙ ---
  const fetchAllAlerts = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      // Используем роут для получения ВСЕХ уведомлений
      const response = await axios.get(`${API_BASE_URL}/api/alerts/all`, config)

      setAlerts(response.data)
      // При загрузке страницы помечаем все уведомления как прочитанные
      // response.data.filter(a => !a.isRead).forEach(a => markAsRead(a._id));
    } catch (err) {
      console.error('Error fetching all alerts:', err)
      setError('Не удалось загрузить полный список уведомлений. Проверьте права доступа и сервер.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchAllAlerts()
  }, [fetchAllAlerts])

  if (loading) return <div className='container mt-5 text-light'>Загрузка центра уведомлений...</div>
  if (error) return <div className='container mt-5 alert alert-danger'>{error}</div>

  return (
    <div className='container mt-4'>
      <h1 className='text-light mb-4'>Центр Уведомлений</h1>
      <p className='text-muted'>Отображены все уведомления, доступные Вашей роли, отсортированные по времени.</p>

      <div className='list-group mt-4'>
        {alerts.length === 0 ? (
          <div
            className='list-group-item list-group-item-dark text-center'
            style={{ backgroundColor: '#303030' }}
          >
            У вас нет новых или доступных уведомлений.
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert._id}
              className={`list-group-item d-flex justify-content-between align-items-center flex-wrap ${
                alert.level === 'high' ? 'list-group-item-danger' : 'list-group-item-warning'
              }`}
              style={{
                backgroundColor: !alert.isRead ? '#303030' : '#282c34', // Темный фон для прочитанных
                borderLeft: !alert.isRead ? '5px solid red' : '1px solid #444',
                color: '#fff',
                marginBottom: '5px',
              }}
            >
              {/* ЛЕВАЯ ЧАСТЬ: Информация об уведомлении */}
              <div style={{ flexGrow: 1, marginRight: '15px' }}>
                <div className='d-flex align-items-center mb-1'>
                  <i
                    className={`fas fa-exclamation-triangle me-2 ${
                      alert.level === 'high' ? 'text-danger' : 'text-warning'
                    }`}
                  ></i>
                  <span style={{ fontWeight: !alert.isRead ? 'bold' : 'normal', fontSize: '1.1rem' }}>
                    {alert.title || `Тревога по активу: ${alert.asset}`}
                  </span>
                </div>
                <div className='text-sm mb-1 ms-4'>{`[${alert.sensor_id} / ${alert.wsection}]: ${alert.message}`}</div>

                {/* Дата */}
                <small className='text-muted ms-4'>
                  {moment(alert.createdAt).locale('ru').format('D MMMM YYYY, HH:mm')}
                </small>
              </div>

              {/* ПРАВАЯ ЧАСТЬ: Действия */}
              <div className='text-end d-flex align-items-center flex-column'>
                {!alert.resolvedBy ? (
                  <>
                    <span className={`badge bg-${alert.level === 'high' ? 'danger' : 'warning'} mb-2`}>АКТИВНАЯ</span>
                    <button
                      className='btn btn-sm btn-success py-0 px-2'
                      onClick={() => resolveAlert(alert._id)}
                      disabled={alert.isResolved}
                    >
                      Решить
                    </button>
                  </>
                ) : (
                  <small
                    className='text-success'
                    style={{ fontSize: '0.9rem' }}
                  >
                    Решено: {alert.resolvedBy}
                    <br />
                    {moment(alert.resolvedAt).locale('ru').format('DD.MM HH:mm')}
                  </small>
                )}

                {/* Кнопка "Прочитано" (если не решена) */}
                {!alert.resolvedBy && !alert.isRead && (
                  <button
                    className='btn btn-sm btn-outline-info py-0 px-2 mt-2'
                    onClick={() => markAsRead(alert._id)}
                    style={{ fontSize: '0.7rem' }}
                  >
                    Пометить как прочитанное
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default NotificationCenter
