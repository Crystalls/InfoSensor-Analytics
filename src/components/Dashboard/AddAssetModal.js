import React, { useState } from 'react'

const AddAssetModal = ({ onClose, onSubmit, availableWorkshops, engineerName }) => {
  const [assetName, setAssetName] = useState('')
  const [workshop, setWorkshop] = useState(availableWorkshops[0] || '')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!assetName.trim()) {
      setError('Имя актива не может быть пустым.')
      return
    }
    if (!workshop) {
      setError('Необходимо выбрать сектор.')
      return
    }

    onSubmit({
      assetName: assetName.trim(),
      workshop: workshop,
      responsibleEngineer: engineerName, // Автоматически назначаем текущего инженера
    })
  }

  // Стили для имитации темного модального окна
  const modalBackdropStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Затемнение
    zIndex: 1050,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  }

  const modalContentStyle = {
    backgroundColor: '#2e2e38', // Темный фон контента
    color: 'white',
    border: '1px solid #444',
    borderRadius: '8px',
    width: '450px',
    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)',
  }

  const inputStyle = {
    backgroundColor: '#444',
    color: 'white',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '8px',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div
      style={modalBackdropStyle}
      onClick={onClose}
    >
      <div
        style={modalContentStyle}
        className='p-4'
        onClick={(e) => e.stopPropagation()}
      >
        <h5 className='text-warning border-bottom pb-2 mb-3'>Добавить новый актив</h5>

        {error && <div className='alert alert-danger p-2 mb-3'>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className='mb-3'>
            <label
              className='form-label'
              style={{ color: 'white' }}
            >
              Название актива (Уникальное):
            </label>
            <input
              type='text'
              className='form-control'
              style={inputStyle}
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
            />
          </div>

          <div className='mb-3'>
            <label
              className='form-label'
              style={{ color: 'white' }}
            >
              Рабочий сектор:
            </label>
            <select
              className='form-select'
              style={inputStyle}
              value={workshop}
              onChange={(e) => setWorkshop(e.target.value)}
            >
              {availableWorkshops.map((w) => (
                <option
                  key={w}
                  value={w}
                >
                  {w}
                </option>
              ))}
            </select>
          </div>

          <p style={{ fontSize: '0.85rem', color: '#aaa' }}>
            Ответственный инженер: {engineerName} (будет назначен автоматически)
          </p>

          <div className='d-flex justify-content-end mt-4 gap-2'>
            <button
              type='button'
              className='btn btn-secondary'
              onClick={onClose}
            >
              Отмена
            </button>
            <button
              type='submit'
              className='btn btn-success'
            >
              Сохранить Актив
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddAssetModal
