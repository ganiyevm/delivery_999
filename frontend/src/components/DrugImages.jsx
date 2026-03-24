import React, { useState } from 'react';

const DRUG_SVGS = {
    blister: (color = '#27AE60') => (
        <svg viewBox="0 0 120 100" width="72" height="60">
            <defs><linearGradient id="gb" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={color} /><stop offset="100%" stopColor="#1565C0" /></linearGradient></defs>
            <rect x="10" y="15" width="100" height="70" rx="8" fill="url(#gb)" opacity="0.15" />
            <rect x="15" y="20" width="90" height="60" rx="6" fill="url(#gb)" opacity="0.25" />
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                <circle key={i} cx={30 + (i % 4) * 20} cy={38 + Math.floor(i / 4) * 24} r="8" fill="url(#gb)" opacity="0.8" />
            ))}
        </svg>
    ),
    capsBottle: (color = '#1565C0') => (
        <svg viewBox="0 0 120 100" width="72" height="60">
            <defs><linearGradient id="gc" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={color} /><stop offset="100%" stopColor="#27AE60" /></linearGradient></defs>
            <rect x="35" y="10" width="50" height="15" rx="4" fill="#8B6914" opacity="0.6" />
            <rect x="30" y="22" width="60" height="68" rx="10" fill="url(#gc)" opacity="0.3" />
            <rect x="30" y="22" width="60" height="68" rx="10" fill="none" stroke="url(#gc)" strokeWidth="2" />
            <ellipse cx="60" cy="55" rx="15" ry="8" fill="url(#gc)" opacity="0.5" />
            <text x="60" y="75" textAnchor="middle" fontSize="10" fill={color} fontWeight="bold">500mg</text>
        </svg>
    ),
    syrupBottle: (color = '#e74c3c') => (
        <svg viewBox="0 0 120 100" width="72" height="60">
            <defs><linearGradient id="gs" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={color} /><stop offset="100%" stopColor="#f39c12" /></linearGradient></defs>
            <rect x="45" y="5" width="30" height="12" rx="3" fill={color} opacity="0.4" />
            <rect x="35" y="15" width="50" height="75" rx="8" fill="url(#gs)" opacity="0.25" />
            <rect x="35" y="15" width="50" height="75" rx="8" fill="none" stroke="url(#gs)" strokeWidth="2" />
            <rect x="40" y="50" width="40" height="35" rx="4" fill="url(#gs)" opacity="0.3" />
            <text x="60" y="72" textAnchor="middle" fontSize="9" fill={color} fontWeight="bold">SIROP</text>
        </svg>
    ),
    creamTube: (color = '#9b59b6') => (
        <svg viewBox="0 0 120 100" width="72" height="60">
            <defs><linearGradient id="gt" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={color} /><stop offset="100%" stopColor="#e74c3c" /></linearGradient></defs>
            <rect x="50" y="5" width="20" height="15" rx="3" fill={color} opacity="0.5" />
            <path d="M35,20 Q35,18 37,18 L83,18 Q85,18 85,20 L85,85 Q85,90 80,90 L40,90 Q35,90 35,85 Z" fill="url(#gt)" opacity="0.25" />
            <path d="M35,20 Q35,18 37,18 L83,18 Q85,18 85,20 L85,85 Q85,90 80,90 L40,90 Q35,90 35,85 Z" fill="none" stroke="url(#gt)" strokeWidth="2" />
        </svg>
    ),
    vitaminBot: (color = '#f39c12') => (
        <svg viewBox="0 0 120 100" width="72" height="60">
            <defs><linearGradient id="gv" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={color} /><stop offset="100%" stopColor="#e67e22" /></linearGradient></defs>
            <circle cx="60" cy="50" r="35" fill="url(#gv)" opacity="0.2" />
            <circle cx="60" cy="50" r="35" fill="none" stroke="url(#gv)" strokeWidth="2" />
            <text x="60" y="47" textAnchor="middle" fontSize="16" fill={color} fontWeight="900">D3</text>
            <text x="60" y="62" textAnchor="middle" fontSize="8" fill={color}>VITAMIN</text>
        </svg>
    ),
    tonometer: (color = '#e74c3c') => (
        <svg viewBox="0 0 120 100" width="72" height="60">
            <defs><linearGradient id="gtn" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={color} /><stop offset="100%" stopColor="#c0392b" /></linearGradient></defs>
            <rect x="25" y="20" width="70" height="55" rx="10" fill="url(#gtn)" opacity="0.15" />
            <rect x="25" y="20" width="70" height="55" rx="10" fill="none" stroke="url(#gtn)" strokeWidth="2" />
            <text x="60" y="45" textAnchor="middle" fontSize="14" fill={color} fontWeight="900">120</text>
            <text x="60" y="58" textAnchor="middle" fontSize="10" fill={color} fontWeight="700">/80</text>
            <text x="60" y="70" textAnchor="middle" fontSize="7" fill={color}>mmHg</text>
        </svg>
    ),
    heartPill: (color = '#e74c3c') => (
        <svg viewBox="0 0 120 100" width="72" height="60">
            <defs><linearGradient id="gh" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={color} /><stop offset="100%" stopColor="#c0392b" /></linearGradient></defs>
            <path d="M60,80 C30,60 15,40 25,25 C35,10 55,15 60,30 C65,15 85,10 95,25 C105,40 90,60 60,80Z" fill="url(#gh)" opacity="0.25" />
            <path d="M60,80 C30,60 15,40 25,25 C35,10 55,15 60,30 C65,15 85,10 95,25 C105,40 90,60 60,80Z" fill="none" stroke="url(#gh)" strokeWidth="2" />
            <circle cx="60" cy="48" r="8" fill="url(#gh)" opacity="0.6" />
        </svg>
    ),
    gastroBot: (color = '#27AE60') => (
        <svg viewBox="0 0 120 100" width="72" height="60">
            <defs><linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={color} /><stop offset="100%" stopColor="#2ecc71" /></linearGradient></defs>
            <ellipse cx="60" cy="50" rx="32" ry="38" fill="url(#gg)" opacity="0.2" />
            <ellipse cx="60" cy="50" rx="32" ry="38" fill="none" stroke="url(#gg)" strokeWidth="2" />
            <path d="M45,35 Q60,50 50,65 Q55,70 65,65 Q75,50 65,35" fill="none" stroke="url(#gg)" strokeWidth="2" />
        </svg>
    ),
};

const CATEGORY_IMAGE_MAP = {
    pain: 'blister',
    antibiotics: 'capsBottle',
    vitamins: 'vitaminBot',
    heart: 'heartPill',
    children: 'syrupBottle',
    cosmetics: 'creamTube',
    devices: 'tonometer',
    stomach: 'gastroBot',
    other: 'blister',
};

const CATEGORY_COLORS = {
    pain: '#27AE60',
    antibiotics: '#1565C0',
    vitamins: '#f39c12',
    heart: '#e74c3c',
    children: '#e91e63',
    cosmetics: '#9b59b6',
    devices: '#e74c3c',
    stomach: '#27AE60',
    other: '#95a5a6',
};

export default function DrugImage({ imageType, imageUrl, category, size = 72 }) {
    const [imgError, setImgError] = useState(false);

    if (imageUrl && !imgError) {
        return (
            <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                <img
                    src={imageUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={() => setImgError(true)}
                />
            </div>
        );
    }

    const type = imageType || CATEGORY_IMAGE_MAP[category] || 'blister';
    const color = CATEGORY_COLORS[category] || '#27AE60';
    const renderer = DRUG_SVGS[type] || DRUG_SVGS.blister;

    return (
        <div style={{ width: size, height: size * 0.83, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {renderer(color)}
        </div>
    );
}

export { CATEGORY_IMAGE_MAP, CATEGORY_COLORS };
