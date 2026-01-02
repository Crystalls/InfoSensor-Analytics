import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../Navbar/Navbar.css'
import logo from '../../img/logo.png'

function Navbar({ isLoggedIn, onLogout, user }) {
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
                {/* Общий обзор */}
                <li>
                  <Link to='/overview'>Обзор Системы</Link>
                  <Link to='/assets'>Реестр Активов</Link>
                </li>
                {/* ДИНАМИЧЕСКАЯ НАВИГАЦИЯ ПО РОЛИ */}
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
                  <Link to='/'>Аналитические графики</Link>
                </li>
              </>
            )}
          </ul>
        </div>
        <div className='login_links'>
          <ul>
            {!isLoggedIn && (
              <>
                <li>
                  <Link to='/register'>Зарегистрироваться</Link>
                </li>
                <li>
                  <Link to='/login'>Войти</Link>
                </li>
              </>
            )}
            {isLoggedIn && (
              <>
                <li style={{ marginRight: '15px', color: 'white' }}>{user?.nameU}</li>
                <li>
                  <button
                    className='logout_btn'
                    onClick={handleLogout}
                  >
                    Выйти
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </header>
  )
}

export default Navbar
