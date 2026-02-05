
import React, { createContext, useContext, useState, useEffect } from 'react';

const NotificationContext = createContext();

export function useNotification() {
    return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
    const [notification, setNotification] = useState(null);

    const showNotification = (message, type = 'info') => {
        setNotification({ message, type });
        // Auto clear after 2 seconds
        setTimeout(() => {
            setNotification(null);
        }, 2000);
    };

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            {notification && (
                <div className={`toast-notification toast-${notification.type}`}>
                    {notification.message}
                </div>
            )}
        </NotificationContext.Provider>
    );
}
