import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../services/api'

const AssetEditor = ({ assetData, token, onClose, onUpdateSuccess }) => {
  const [workshop, setWorkshop] = useState(assetData.workshop || '')
  const [responsible, setResponsible] = useState(assetData.responsibleEngineer || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }

      await axios.put(
        `${API_BASE_URL}/api/assets/${assetData.name}`,
        { workshop, responsibleEngineer: responsible },
        config,
      )

      alert(`Актив ${assetData.name} успешно обновлен!`)
      onUpdateSuccess() // Сообщаем родителю, что нужно перезагрузить данные
      onClose()
    } catch (err) {
      console.error('Error editing asset:', err)
      setError(err.response?.data?.message || 'Ошибка сервера при редактировании.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className='custom-modal-backdrop'
      style={{ color: '#fff' }}
    >
      <div
        className='modal fade show'
        style={{ display: 'block' }}
        tabIndex='-1'
      >
        <div className='modal-dialog modal-lg'>
          <div className='modal-content'>
            <form onSubmit={handleSubmit}>
              <div className='modal-header bg-warning text-dark'>
                <h5 className='modal-title'>Редактирование Актива: {assetData.name}</h5>
                <button
                  type='button'
                  className='btn-close'
                  onClick={onClose}
                  aria-label='Close'
                ></button>
              </div>
              <div className='modal-body'>
                {error && <div className='alert alert-danger'>{error}</div>}

                <div className='mb-3'>
                  <label className='form-label'>Цех</label>
                  <input
                    type='text'
                    className='form-control'
                    value={workshop}
                    onChange={(e) => setWorkshop(e.target.value)}
                    required
                  />
                </div>
                <div className='mb-3'>
                  <label className='form-label'>Ответственный Инженер</label>
                  <input
                    type='text'
                    className='form-control'
                    value={responsible}
                    onChange={(e) => setResponsible(e.target.value)}
                  />
                </div>
              </div>
              <div className='modal-footer'>
                <button
                  type='button'
                  className='btn btn-secondary'
                  onClick={onClose}
                  disabled={loading}
                >
                  Отмена
                </button>
                <button
                  type='submit'
                  className='btn btn-primary'
                  disabled={loading}
                >
                  {loading ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssetEditor
