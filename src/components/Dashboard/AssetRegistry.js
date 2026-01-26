import React, { useState, useEffect, useMemo, useCallback } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import AssetEditor from './AssetEditor'
import AddAssetModal from './AddAssetModal'
import { API_BASE_URL } from '../../services/api'
import moment from 'moment'

const POLLING_INTERVAL_MS = 10000

const AssetRegistry = ({ user, token, onTokenUpdate }) => {
  // Добавил onTokenUpdate, если нужно
  const [assetsData, setAssetsData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Состояния фильтрации
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [editorAsset, setEditorAsset] = useState(null)

  // Состояния для добавления нового актива
  const [showAddModal, setShowAddModal] = useState(false)
  const [workshopsList, setWorkshopsList] = useState([]) // Список цехов для модального окна

  const WorkerName = user?.nameU
  const WorkerProfession = user?.profession

  // 1. ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ (включая цеха)
  const fetchAssets = useCallback(async () => {
    if (!token) {
      setError('Авторизационный токен отсутствует.')
      setLoading(false)
      return
    }

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }

      // Запрос активов
      const assetsResponse = await axios.get(`${API_BASE_URL}/api/assets-with-live-data`, config)
      setAssetsData(assetsResponse.data)

      // Запрос списка цехов (ВАЖНО для первого запуска)
      const workshopsResponse = await axios.get(`${API_BASE_URL}/api/workshops`, config)
      setWorkshopsList(workshopsResponse.data.workshops || [])
    } catch (err) {
      console.error('Error fetching asset registry or workshops:', err)
      if (assetsData.length === 0) {
        setError('Не удалось загрузить реестр активов.')
      }
    } finally {
      if (loading) {
        setLoading(false)
      }
    }
  }, [token, loading, assetsData.length])

  // 2. POLLING ЭФФЕКТ
  useEffect(() => {
    fetchAssets()
    const intervalId = setInterval(fetchAssets, POLLING_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [fetchAssets])

  // 3. ФИЛЬТРАЦИЯ И ПОИСК
  const filteredAssets = useMemo(() => {
    return assetsData.filter((asset) => {
      const name = asset.name || asset.assetName || ''
      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase())
      let matchesStatus = true
      if (filterStatus !== 'All') {
        matchesStatus = asset.status === filterStatus
      }
      return matchesSearch && matchesStatus
    })
  }, [assetsData, searchTerm, filterStatus])

  // 4. ОБРАБОТКА ДОБАВЛЕНИЯ НОВОГО АКТИВА
  const handleAddAsset = async (newAssetData) => {
    if (!token) return
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }
      const response = await axios.post(`${API_BASE_URL}/api/assets`, newAssetData, config)

      // Если бэкенд вернул новый токен (для обновления прав доступа), сохраняем его
      if (response.data.newToken && onTokenUpdate) {
        onTokenUpdate(response.data.newToken)
      }

      fetchAssets() // Обновляем список
      setShowAddModal(false)
      alert(`Актив "${newAssetData.assetName}" успешно создан.`)
    } catch (error) {
      alert(error.response?.data?.message || 'Ошибка при добавлении актива.')
    }
  }

  // --- ОТОБРАЖЕНИЕ СОСТОЯНИЙ ---
  if (loading && assetsData.length === 0)
    return <div className='container mt-4 text-light'>Загрузка реестра активов...</div>
  if (error) return <div className='alert alert-danger container mt-4'>Ошибка: {error}</div>

  // Если данные есть, но фильтры ничего не нашли (показываем фильтры и кнопку)
  if (filteredAssets.length === 0 && assetsData.length > 0) {
    // ... (Отрисовка фильтров и кнопки сброса) ...
  }

  // --- УСЛОВНЫЙ РЕНДЕРИНГ ПРИ ПУСТОЙ КОЛЛЕКЦИИ ---
  if (assetsData.length === 0) {
    return (
      <div className='container mt-4'>
        <div className='alert alert-info container mt-4'>У вас нет зарегистрированных активов для управления.</div>

        {/* Кнопка и модальное окно, видимые при пустой коллекции (для инициализации) */}
        {(WorkerProfession === 'engineer' || WorkerProfession === 'admin' || WorkerProfession === 'scientist') && (
          <button
            className='btn btn-success mt-3'
            onClick={() => setShowAddModal(true)}
          >
            Добавить новый актив
          </button>
        )}

        {showAddModal && (
          <AddAssetModal
            onClose={() => setShowAddModal(false)}
            onSubmit={handleAddAsset}
            // Если список цехов пуст, используем цех пользователя (для первого запуска)
            availableWorkshops={workshopsList.length > 0 ? workshopsList : [user.wsection || 'Цех']}
            WorkerName={WorkerName}
          />
        )}
      </div>
    )
  }

  // --- РЕНДЕРИНГ ТАБЛИЦЫ ---
  return (
    <div className='container mt-4'>
      <h1>Реестр активов (Роль пользователя - {user?.profession})</h1>
      <p>
        Просмотр и управление оборудованием, доступным Вам по праву доступа.
        <span className='text-muted ms-3'> (Обновление каждые {POLLING_INTERVAL_MS / 1000} сек)</span>
      </p>

      {/* --- БЛОК ПОИСКА И ФИЛЬТРАЦИИ --- */}
      {/* ... (Ваш JSX для поиска и фильтрации) ... */}

      <table className='table table-striped table-dark'>
        <thead>
          <tr>
            <th>#</th>
            <th>Название актива</th>
            <th>Цех</th>
            <th>Статус</th>
            <th>Последнее значение</th>
            <th>Время</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {filteredAssets.map((asset, index) => (
            <tr key={asset.name}>
              <td>{index + 1}</td>
              <td>
                <strong>{asset.name}</strong>
              </td>
              <td>{asset.workshop}</td>
              <td>
                <span className={asset.statusColor}>{asset.status}</span>
              </td>
              <td>{asset.lastValue}</td>
              <td>
                {asset.lastTimestamp !== 'N/A'
                  ? moment.utc(asset.lastTimestamp).local().format('HH:mm:ss') // <-- ФОРМАТИРУЕМ В ЛОКАЛЬНОЕ ВРЕМЯ КЛИЕНТА
                  : 'N/A'}
              </td>
              <td>
                <Link
                  to={`/assets/${asset.name}`}
                  className='btn btn-sm btn-outline-info me-2'
                >
                  Детали
                </Link>
                <button
                  className='btn btn-sm btn-warning'
                  onClick={() => setEditorAsset(asset)}
                >
                  Ред.
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Кнопка "Добавить Новый Актив" */}
      {(WorkerProfession === 'engineer' || WorkerProfession === 'admin' || WorkerProfession === 'scientist') && (
        <button
          className='btn btn-success mt-3'
          onClick={() => setShowAddModal(true)}
        >
          Добавить новый актив
        </button>
      )}

      {/* Модальное окно (рендерится только если showAddModal true) */}
      {showAddModal && (
        <AddAssetModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddAsset}
          availableWorkshops={workshopsList.length > 0 ? workshopsList : [user.wsection || 'Цех']}
          WorkerName={WorkerName}
        />
      )}

      {/* ... (AssetEditor) ... */}
    </div>
  )
}

export default AssetRegistry
