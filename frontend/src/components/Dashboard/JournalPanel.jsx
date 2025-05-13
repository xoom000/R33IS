import React, { useState, useEffect } from 'react';
import { journalService } from '../../services/api';

const JournalPanel = ({ customerId, currentPosition }) => {
  const [journalEntries, setJournalEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newEntry, setNewEntry] = useState('');
  const [entryType, setEntryType] = useState('note');
  
  // Fetch journal entries
  useEffect(() => {
    const fetchJournalEntries = async () => {
      try {
        setLoading(true);
        const response = await journalService.getCustomerEntries(customerId);
        setJournalEntries(response.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch journal entries:', err);
        setError('Failed to load journal entries. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    if (customerId) {
      fetchJournalEntries();
    }
  }, [customerId]);
  
  // Handle creating a new journal entry
  const handleCreateEntry = async (e) => {
    e.preventDefault();
    
    if (!newEntry.trim()) return;
    
    try {
      setLoading(true);
      
      // Prepare location data if available
      let location = null;
      if (currentPosition) {
        location = {
          latitude: currentPosition.latitude,
          longitude: currentPosition.longitude,
          accuracy: currentPosition.accuracy
        };
      }
      
      const entryData = {
        customer_id: customerId,
        entry_type: entryType,
        content: newEntry,
        location: location ? JSON.stringify(location) : null,
      };
      
      const response = await journalService.createEntry(entryData);
      
      // Add new entry to list
      setJournalEntries(prevEntries => [response.data, ...prevEntries]);
      
      // Clear form
      setNewEntry('');
      setEntryType('note');
      setError(null);
    } catch (err) {
      console.error('Failed to create journal entry:', err);
      setError('Failed to save journal entry. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Render entry type badge with appropriate color
  const EntryTypeBadge = ({ type }) => {
    const types = {
      note: { label: 'Note', class: 'bg-blue-100 text-blue-800 border-blue-200' },
      activity: { label: 'Activity', class: 'bg-green-100 text-green-800 border-green-200' },
      issue: { label: 'Issue', class: 'bg-red-100 text-red-800 border-red-200' },
      request: { label: 'Request', class: 'bg-purple-100 text-purple-800 border-purple-200' },
      complaint: { label: 'Complaint', class: 'bg-orange-100 text-orange-800 border-orange-200' },
      review: { label: 'Review', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    };
    
    const entryType = types[type] || types.note;
    
    return (
      <span className={`text-xs px-2 py-1 rounded border ${entryType.class}`}>
        {entryType.label}
      </span>
    );
  };
  
  // Render sentiment indicator based on sentiment score
  const SentimentIndicator = ({ score }) => {
    if (score === null || score === undefined) return null;
    
    let icon, color;
    if (score >= 0.3) {
      icon = '😊';
      color = 'text-green-600';
    } else if (score >= -0.3) {
      icon = '😐';
      color = 'text-yellow-600';
    } else {
      icon = '😟';
      color = 'text-red-600';
    }
    
    return <span className={`text-lg ${color}`}>{icon}</span>;
  };
  
  return (
    <div className="space-y-6">
      {/* Create journal entry form */}
      <form onSubmit={handleCreateEntry} className="bg-gray-50 p-4 rounded">
        <h3 className="font-bold text-gray-700 mb-3">Create Journal Entry</h3>
        
        <div className="mb-3">
          <label htmlFor="entryContent" className="block text-sm font-medium text-gray-700 mb-1">
            Entry
          </label>
          <textarea
            id="entryContent"
            value={newEntry}
            onChange={(e) => setNewEntry(e.target.value)}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter journal entry..."
            required
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="entryType" className="block text-sm font-medium text-gray-700 mb-1">
            Entry Type
          </label>
          <select
            id="entryType"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="note">Note</option>
            <option value="activity">Activity</option>
            <option value="issue">Issue</option>
            <option value="request">Request</option>
            <option value="complaint">Complaint</option>
            <option value="review">Review</option>
          </select>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !newEntry.trim()}
            className={`px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              loading || !newEntry.trim() ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </form>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}
      
      {/* Journal entries list */}
      <div>
        <h3 className="font-bold text-gray-700 mb-3">Journal History</h3>
        
        {loading && journalEntries.length === 0 ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading journal entries...</p>
          </div>
        ) : journalEntries.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded">
            <p className="text-gray-500">No journal entries available for this customer.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {journalEntries.map((entry) => (
              <div key={entry.id} className="border border-gray-200 rounded-md p-4 bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <EntryTypeBadge type={entry.entry_type} />
                    <SentimentIndicator score={entry.sentiment_score} />
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
                
                <p className="text-gray-800 whitespace-pre-wrap">{entry.content}</p>
                
                <div className="mt-3 flex justify-between items-center text-sm">
                  <span className="text-gray-500">
                    By: {entry.created_by_username || 'Unknown'}
                  </span>
                  
                  {entry.location && (
                    <span className="text-gray-500">
                      Location: {
                        (() => {
                          try {
                            const loc = JSON.parse(entry.location);
                            return `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
                          } catch {
                            return 'Recorded';
                          }
                        })()
                      }
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default JournalPanel;