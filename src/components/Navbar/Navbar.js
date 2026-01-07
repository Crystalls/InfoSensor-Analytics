import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../Navbar/Navbar.css'
import logo from '../../img/logo.png'
import AlertsDropdown from '../AlertList/AlertsDropdown'

function Navbar({ isLoggedIn, onLogout, user, token }) {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user') // Remove user data
    onLogout()
    navigate('/login')
  }

  return (
    <header className='header'>
      <div className='header_cont'>
        <div className='Logo'>
          <img
            src={logo}
            alt='Logo'
            className='LogoHeader'
          />
        </div>
        <div className='links'>
          <ul>
            <li>
              <Link to='/Home'>Главная страница</Link>
            </li>
            <li>
              <Link to='/aboutUs'>О нас</Link>
            </li>

            {isLoggedIn && (
              <>
                <li>
                  <Link to='/overview'>Обзор Системы</Link>
                </li>
                <li>
                  <Link to='/assets'>Реестр Активов</Link>
                </li>
                {user?.profession === 'engineer' && (
                  <li>
                    <Link to='/dashboard-engineer'>Обзорная панель инженера</Link>
                  </li>
                )}
                {user?.profession === 'scientist' && (
                  <li>
                    <Link to='/dashboard-scientist'>Обзорная панель ученого</Link>
                  </li>
                )}
                <li>
                  <Link to='/analytics'>Аналитические графики</Link>
                </li>
              </>
            )}
          </ul>
        </div>

        {/* --- СЕКЦИЯ ДЕЙСТВИЙ ПОЛЬЗОВАТЕЛЯ (Используем d-flex) --- */}
        <div className='user_actions'>
          {!isLoggedIn ? (
            <div className='login_links'>
              <ul>
                <li>
                  <Link to='/register'>Зарегистрироваться</Link>
                </li>
                <li>
                  <Link to='/login'>Войти</Link>
                </li>
              </ul>
            </div>
          ) : (
            // Flex-контейнер для выравнивания колокольчика, имени и кнопки
            <div className='d-flex align-items-center'>
              {/* 1. КОЛОКОЛЬЧИК (Margin Right для отступа) */}
              <div className='me-3'>
                <AlertsDropdown token={token} />
              </div>

              {/* 2. Имя пользователя и Выход */}
              <ul className='d-flex mb-0 p-0 list-unstyled'>
                <li
                  className='profile_btn'
                  style={{ color: 'white' }}
                >
                  {user?.nameU}
                </li>
                <li>
                  <button
                    className='logout_btn'
                    onClick={handleLogout}
                  >
                    Выйти
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
        {/* ----------------------------------------------------- */}
      </div>
    </header>
  )
}

export default Navbar
