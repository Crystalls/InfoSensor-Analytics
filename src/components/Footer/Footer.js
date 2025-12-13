import React from 'react'
import './Footer.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faVk, faTelegram, faDiscord } from '@fortawesome/free-brands-svg-icons'

const Footer = () => {
  return (
    <footer className='footer'>
      <div className='footer-content'>
        <p>&copy; {new Date().getFullYear()} ИнфоСенсор Аналитика</p>
        <ul>
          <li>
            <a href='/privacy-policy'>Политика конфиденциальности</a>
          </li>
          <li>
            <a href='/terms-of-service'>Условия использования</a>
          </li>
        </ul>
        <ul>
          <div className='social-media'>
            <a
              href='https://vk.com'
              target='_blank'
              rel='noopener noreferrer'
            >
              <FontAwesomeIcon
                icon={faVk}
                className='icon'
              />
            </a>
            <a
              href='https://telegram.org'
              target='_blank'
              rel='noopener noreferrer'
            >
              <FontAwesomeIcon
                icon={faTelegram}
                className='icon'
              />
            </a>
            <a
              href='https://discord.com'
              target='_blank'
              rel='noopener noreferrer'
            >
              <FontAwesomeIcon
                icon={faDiscord}
                className='icon'
              />
            </a>
          </div>
        </ul>
      </div>
    </footer>
  )
}

export default Footer
