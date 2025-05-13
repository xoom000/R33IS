import React from 'react';
import { FaWifi, FaCloudDownloadAlt, FaExclamationTriangle } from 'react-icons/fa';
import useOfflineStatus from '../../hooks/useOfflineStatus';

/**
 * Component that displays information when the app is being used in offline mode
 */
const OfflineNotice = ({ className }) => {
  const { isOffline, hasOfflineData, offlineContentSource, refreshOfflineStatus } = useOfflineStatus();

  // Don't render anything if online
  if (!isOffline) {
    return null;
  }

  return (
    <div className={`bg-gray-100 border border-gray-300 rounded-lg p-4 mb-4 ${className}`}>
      <div className="flex items-center mb-2">
        <FaWifi className="text-red-500 mr-2" />
        <h3 className="text-lg font-semibold">You are currently offline</h3>
      </div>

      <div className="mb-2">
        {hasOfflineData ? (
          <div className="flex items-start">
            <FaCloudDownloadAlt className="text-green-500 mt-1 mr-2" />
            <div>
              <p className="text-sm text-gray-700">
                You're viewing data from your last online session. Some features may be limited.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Data source: {offlineContentSource === 'indexedDB' ? 'Local database' : 'Browser cache'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start">
            <FaExclamationTriangle className="text-amber-500 mt-1 mr-2" />
            <p className="text-sm text-gray-700">
              No stored data is available. Full functionality will be restored when you reconnect.
            </p>
          </div>
        )}
      </div>

      <div className="text-center mt-3">
        <button
          onClick={refreshOfflineStatus}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded-md text-sm font-medium"
        >
          Check connection
        </button>
      </div>

      {hasOfflineData && offlineContentSource === 'indexedDB' && (
        <div className="mt-3 border-t border-gray-200 pt-2">
          <p className="text-xs text-gray-500">
            Any changes you make while offline will be automatically synced when your connection is restored.
          </p>
        </div>
      )}
    </div>
  );
};

export default OfflineNotice;