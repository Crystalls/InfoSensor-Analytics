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
              <Link to='/'>Главная страница</Link>
            </li>
            <li>
              <Link to='/'>О нас</Link>
            </li>

            {isLoggedIn && (
              <>
                {/* Общий обзор */}
                <li>
                  <Link to='/overview'>Обзор Системы</Link>
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
                  <Link to='/register'>Register</Link>
                </li>
                <li>
                  <Link to='/login'>Login</Link>
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
                    Logout
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
