import React, { useState, useEffect } from 'react';
import { notesService } from '../../services/api';

const NotesPanel = ({ customerId }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [priority, setPriority] = useState('medium');
  
  // Fetch customer notes
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        setLoading(true);
        const response = await notesService.getCustomerNotes(customerId);
        setNotes(response.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch notes:', err);
        setError('Failed to load notes. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    if (customerId) {
      fetchNotes();
    }
  }, [customerId]);
  
  // Handle creating a new note
  const handleCreateNote = async (e) => {
    e.preventDefault();
    
    if (!newNote.trim()) return;
    
    try {
      setLoading(true);
      
      const noteData = {
        customer_id: customerId,
        text: newNote,
        priority,
        assigned_day: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
      };
      
      const response = await notesService.createNote(noteData);
      
      // Add new note to list
      setNotes(prevNotes => [response.data, ...prevNotes]);
      
      // Clear form
      setNewNote('');
      setPriority('medium');
      setError(null);
    } catch (err) {
      console.error('Failed to create note:', err);
      setError('Failed to save note. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Render priority badge with appropriate color
  const PriorityBadge = ({ priority }) => {
    const colors = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-green-100 text-green-800 border-green-200',
    };
    
    return (
      <span className={`text-xs px-2 py-1 rounded border ${colors[priority] || colors.medium}`}>
        {priority}
      </span>
    );
  };
  
  return (
    <div className="space-y-6">
      {/* Create note form */}
      <form onSubmit={handleCreateNote} className="bg-gray-50 p-4 rounded">
        <h3 className="font-bold text-gray-700 mb-3">Create New Note</h3>
        
        <div className="mb-3">
          <label htmlFor="noteText" className="block text-sm font-medium text-gray-700 mb-1">
            Note
          </label>
          <textarea
            id="noteText"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter note text..."
            required
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !newNote.trim()}
            className={`px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              loading || !newNote.trim() ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </form>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}
      
      {/* Notes list */}
      <div>
        <h3 className="font-bold text-gray-700 mb-3">Customer Notes</h3>
        
        {loading && notes.length === 0 ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading notes...</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded">
            <p className="text-gray-500">No notes available for this customer.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div key={note.id} className="border border-gray-200 rounded-md p-4 bg-white">
                <div className="flex justify-between items-start mb-2">
                  <PriorityBadge priority={note.priority} />
                  <span className="text-sm text-gray-500">
                    {new Date(note.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                <p className="text-gray-800 whitespace-pre-wrap">{note.text}</p>
                
                <div className="mt-3 flex justify-between items-center text-sm">
                  <span className="text-gray-500">
                    By: {note.created_by_username || 'Unknown'}
                  </span>
                  
                  {note.assigned_day && (
                    <span className="text-gray-500">
                      For: {new Date(note.assigned_day).toLocaleDateString()}
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

export default NotesPanel;