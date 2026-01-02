import React, { useState, useEffect, useMemo, useCallback } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import AssetEditor from './AssetEditor'
import { API_BASE_URL } from '../../services/api'

const POLLING_INTERVAL_MS = 10000

const AssetRegistry = ({ user, token }) => {
  const [assetsData, setAssetsData] = useState([]) // Храним полные данные с бэкенда
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // СОСТОЯНИЕ ДЛЯ ФИЛЬТРАЦИИ
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('All') // 'All', 'Активен', 'Тревога'
  const [editorAsset, setEditorAsset] = useState(null)

  // 1. ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ (вынесена для чистоты кода)
  const fetchAssets = useCallback(async () => {
    if (!token) {
      setError('Авторизационный токен отсутствует.')
      setLoading(false)
      return
    }

    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      }

      // Запрос к новому эндпоинту
      const response = await axios.get(`${API_BASE_URL}/api/assets-with-live-data`, config)

      setAssetsData(response.data)
    } catch (err) {
      console.error('Error fetching asset registry:', err)
      // При ошибке во время Polling мы просто обновляем ошибку, но не сбрасываем loading
      if (assetsData.length === 0) {
        setError('Не удалось загрузить реестр активов.')
      }
      // Не останавливаем Polling, если это не критическая ошибка (например, 401/403)
    } finally {
      // Устанавливаем loading только при первом запуске
      if (loading) {
        setLoading(false)
      }
    }
  }, [token, loading, assetsData.length]) // Добавили assetsData.length для определения первого запуска

  // 2. POLLING ЭФФЕКТ
  useEffect(() => {
    // Первая загрузка при монтировании
    fetchAssets()

    // Настройка интервала для Polling
    const intervalId = setInterval(() => {
      fetchAssets()
    }, POLLING_INTERVAL_MS)

    // ОЧИСТКА: Остановка таймера при размонтировании или потере токена
    return () => clearInterval(intervalId)
  }, [fetchAssets]) // Зависимость только от fetchAssets (которая зависит от token)

  // 3. ФИЛЬТРАЦИЯ И ПОИСК (useMemo для оптимизации)
  const filteredAssets = useMemo(() => {
    return assetsData.filter((asset) => {
      // Фильтр по поисковому запросу (название актива)
      const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase())

      // Фильтр по статусу
      let matchesStatus = true
      if (filterStatus !== 'All') {
        matchesStatus = asset.status === filterStatus
      }

      return matchesSearch && matchesStatus
    })
  }, [assetsData, searchTerm, filterStatus])

  // --- Логика отображения состояний ---

  if (loading && assetsData.length === 0) return <div className='container mt-4'>Загрузка реестра активов...</div>

  if (error) return <div className='alert alert-danger container mt-4'>Ошибка: {error}</div>

  // Если данные есть, но фильтры ничего не нашли
  if (filteredAssets.length === 0 && assetsData.length > 0) {
    return (
      <div className='container mt-4'>
        <h2>Реестр Активов (Инженер)</h2>
        <p>По вашему запросу ничего не найдено. Попробуйте изменить фильтры.</p>
        <button
          className='btn btn-secondary mt-3'
          onClick={() => {
            setSearchTerm('')
            setFilterStatus('All')
          }}
        >
          Сбросить фильтры
        </button>
      </div>
    )
  }

  // Если данных нет совсем (например, Python скрипт не запустился)
  if (assetsData.length === 0) {
    return <div className='alert alert-info container mt-4'>У вас нет зарегистрированных активов для управления.</div>
  }

  // --- РЕНДЕРИНГ ТАБЛИЦЫ ---
  return (
    <div className='container mt-4'>
      <h1>Реестр Активов (Инженер)</h1>
      <p>
        Просмотр и управление оборудованием, доступным Вам по праву доступа.
        <span className='text-muted ms-3'> (Обновление каждые {POLLING_INTERVAL_MS / 1000} сек)</span>
      </p>

      {/* --- БЛОК ПОИСКА И ФИЛЬТРАЦИИ --- */}
      <div className='d-flex justify-content-between mb-3 p-3 border rounded bg-dark text-light'>
        <input
          type='text'
          placeholder='Поиск по названию актива...'
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className='form-control w-50 me-3'
        />

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className='form-select w-auto'
        >
          <option value='All'>Все Статусы</option>
          <option value='Активен'>Активен</option>
          <option value='Тревога'>Тревога</option>
        </select>
      </div>
      {/* --------------------------------- */}

      <table className='table table-striped table-dark'>
        <thead>
          <tr>
            <th>#</th>
            <th>Название Актива</th>
            <th>Цех</th>
            <th>Статус</th>
            <th>Последнее Значение</th>
            <th>Время</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {filteredAssets.map((asset, index) => (
            <tr key={asset.name}>
              {' '}
              {/* Используем asset.name как ключ */}
              <td>{index + 1}</td>
              <td>
                <strong>{asset.name}</strong>
              </td>
              <td>{asset.workshop}</td>
              <td>
                <span className={asset.statusColor}>{asset.status}</span>
              </td>
              <td>{asset.lastValue}</td>
              <td>{asset.lastTimestamp}</td>
              <td>
                <Link
                  to={`/assets/${asset.name}`}
                  className='btn btn-sm btn-outline-info me-2'
                >
                  Детали
                </Link>
                <button
                  className='btn btn-sm btn-warning'
                  onClick={() => setEditorAsset(asset)} // Устанавливаем актив для редактирования
                >
                  Ред.
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className='btn btn-success mt-3'>Добавить Новый Актив</button>
      {editorAsset && (
        <AssetEditor
          assetData={editorAsset}
          token={token}
          onUpdateSuccess={() => fetchAssets()}
          onClose={() => setEditorAsset(null)}
        />
      )}
    </div>
  )
}

export default AssetRegistry
