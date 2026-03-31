import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../api/index';
import { useT } from '../../i18n';

export default function Settings({ onBack }) {
    const { user, updateUser } = useAuth();
    const [darkMode, setDarkMode] = useState(document.documentElement.getAttribute('data-theme') === 'dark');
    const [lang, setLang] = useState(user?.language || 'uz');

    const toggleDark = () => {
        const next = !darkMode;
        setDarkMode(next);
        document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
        localStorage.setItem('theme', next ? 'dark' : 'light');
    };

    const changeLang = async (l) => {
        setLang(l);
        try {
            await userAPI.updateProfile({ language: l });
            updateUser({ language: l });
        } catch (err) { console.error(err); }
    };

    const { t } = useT();

    return (
        <div className="page">
            <div className="back-bar"><button className="back-btn" onClick={onBack}>←</button><h2>⚙️ {t('settings')}</h2></div>

            <div className="setting-row">
                <div><div style={{ fontWeight: 700 }}>{t('darkMode')}</div><div className="text-sm text-gray">{t('darkModeSub')}</div></div>
                <div className={`switch ${darkMode ? 'on' : ''}`} onClick={toggleDark} />
            </div>

            <h3 className="section-title mt-16">{t('language')}</h3>
            <div className="toggle-group" style={{ padding: '0 20px' }}>
                <button className={`toggle-btn ${lang === 'uz' ? 'active' : ''}`} onClick={() => changeLang('uz')}>🇺🇿 O'zbek</button>
                <button className={`toggle-btn ${lang === 'ru' ? 'active' : ''}`} onClick={() => changeLang('ru')}>🇷🇺 Русский</button>
                <button className={`toggle-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => changeLang('en')}>🇬🇧 English</button>
            </div>
        </div>
    );
}
