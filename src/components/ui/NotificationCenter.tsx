import React from 'react';
import type { Notification } from '../../services/websocket';

interface NotificationCenterProps {
  notifications: Notification[];
  onClearNotification: (index: number) => void;
  onClearAllNotifications: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onClearNotification,
  onClearAllNotifications
}) => {
  if (notifications.length === 0) {
    return null;
  }

  // Fonction pour obtenir la classe CSS en fonction du type de notification
  const getNotificationClass = (type: string): string => {
    switch (type) {
      case 'success':
        return 'bg-green-100 border-green-500 text-green-700';
      case 'info':
        return 'bg-blue-100 border-blue-500 text-blue-700';
      case 'warning':
        return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      case 'error':
        return 'bg-red-100 border-red-500 text-red-700';
      default:
        return 'bg-gray-100 border-gray-500 text-gray-700';
    }
  };

  // Fonction pour obtenir l'icône en fonction du type de notification
  const getNotificationIcon = (type: string): React.ReactElement => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  // Formater la date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
  };

  return (
    <div className="fixed bottom-4 right-4 w-80 max-h-96 overflow-y-auto z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold text-gray-200">Notifications</h3>
        <button 
          onClick={onClearAllNotifications}
          className="text-xs text-gray-400 hover:text-gray-200"
        >
          Effacer tout
        </button>
      </div>
      
      <div className="space-y-2">
        {notifications.map((notification, index) => (
          <div 
            key={index} 
            className={`border-l-4 p-3 rounded shadow-md ${getNotificationClass(notification.type)}`}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-start">
                <div className="flex-shrink-0 mr-2">
                  {getNotificationIcon(notification.type)}
                </div>
                <div>
                  <p className="font-bold">{notification.title}</p>
                  <p className="text-sm">{notification.message}</p>
                  {notification.timestamp && (
                    <p className="text-xs mt-1 opacity-75">
                      {formatDate(notification.timestamp)}
                    </p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => onClearNotification(index)}
                className="ml-4 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationCenter;
