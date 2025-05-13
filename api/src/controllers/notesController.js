// src/controllers/notesController.js
// Controller for customer notes functionality

/**
 * Get all notes for a specific customer
 */
const getCustomerNotes = (req, res) => {
  try {
    const db = req.app.locals.db;
    const customerId = req.params.customerId;
    const { day, completed, read, priority, tags } = req.query;
    
    // Check if the customer exists and user has permission
    let customerQuery = 'SELECT RouteNumber FROM customers WHERE CustomerNumber = ?';
    
    db.get(customerQuery, [customerId], (err, customer) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Server error',
          message: 'Error retrieving customer' 
        });
      }
      
      if (!customer) {
        return res.status(404).json({ 
          error: 'Not found',
          message: 'Customer not found' 
        });
      }
      
      // Non-SuperAdmin can only view customers on their route
      if (req.user.role !== 'SuperAdmin' && customer.RouteNumber !== req.user.route) {
        return res.status(403).json({ 
          error: 'Permission denied',
          message: 'You do not have permission to view this customer' 
        });
      }
      
      // Build the query with filters
      let query = `
        SELECT 
          note_id, customer_id, text, created_at, assigned_day, 
          source, is_completed, completed_at, priority, tags, is_read
        FROM 
          customer_notes
        WHERE 
          customer_id = ?
      `;
      
      const queryParams = [customerId];
      
      // Add filters if provided
      if (day) {
        query += ' AND assigned_day = ?';
        queryParams.push(day);
      }
      
      if (completed !== undefined) {
        query += ' AND is_completed = ?';
        queryParams.push(completed === 'true' || completed === '1' ? 1 : 0);
      }
      
      if (read !== undefined) {
        query += ' AND is_read = ?';
        queryParams.push(read === 'true' || read === '1' ? 1 : 0);
      }
      
      if (priority) {
        query += ' AND priority = ?';
        queryParams.push(priority);
      }
      
      if (tags) {
        // Simple tag search - could be enhanced with JSON parsing
        query += ' AND tags LIKE ?';
        queryParams.push(`%${tags}%`);
      }
      
      // Add ordering
      query += ' ORDER BY created_at DESC';
      
      db.all(query, queryParams, (err, notes) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Server error',
            message: 'Error retrieving notes' 
          });
        }
        
        res.json({ 
          success: true,
          customer_id: customerId,
          count: notes.length,
          notes 
        });
      });
    });
  } catch (err) {
    console.error('Get notes error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error retrieving notes' 
    });
  }
};

/**
 * Get notes for today's route stops
 */
const getTodayNotes = (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Get the current day of the week
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    
    // Get the user's route if not SuperAdmin
    const userRoute = req.user.role !== 'SuperAdmin' ? req.user.route : null;
    
    // Query for today's customers and their notes
    let customersQuery = `
      SELECT CustomerNumber, AccountName, RouteNumber
      FROM customers
      WHERE ServiceDays LIKE ?
    `;
    
    const params = [`%${today}%`];
    
    // Restrict to user's route if applicable
    if (userRoute) {
      customersQuery += ' AND RouteNumber = ?';
      params.push(userRoute);
    }
    
    db.all(customersQuery, params, (err, customers) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Server error',
          message: 'Error retrieving customers' 
        });
      }
      
      // Get route-level notes (no customer_id) for this day
      const routeNotesQuery = `
        SELECT 
          n.note_id, n.customer_id, n.text, n.created_at, 
          n.assigned_day, n.source, n.is_completed, n.completed_at, n.priority,
          n.tags, n.is_read,
          'Route Note' as customer_name
        FROM 
          customer_notes n
        WHERE 
          n.customer_id IS NULL
          AND (n.assigned_day = ? OR n.assigned_day IS NULL)
          AND (n.is_completed = 0 OR n.completed_at >= datetime('now', '-1 day'))
        ORDER BY 
          n.priority DESC, n.created_at DESC
      `;
      
      db.all(routeNotesQuery, [today], (routeNotesErr, routeNotes) => {
        if (routeNotesErr) {
          console.error('Database error:', routeNotesErr);
          // Continue with customer notes even if route notes fail
        }
        
        const routeNotesData = routeNotesErr ? [] : routeNotes;
        
        if (customers.length === 0 && routeNotesData.length === 0) {
          return res.json({ 
            success: true,
            date: new Date().toISOString(),
            day: today,
            route_notes: [],
            customers: [], 
            notes: [] 
          });
        }
        
        // Get all customer IDs
        const customerIds = customers.map(c => c.CustomerNumber);
        
        // If no customers found but we have route notes, return those
        if (customers.length === 0) {
          return res.json({
            success: true,
            date: new Date().toISOString(),
            day: today,
            route_notes: routeNotesData,
            customerCount: 0,
            noteCount: routeNotesData.length,
            customers: []
          });
        }
        
        // Query for notes for these customers with today's assigned day
        const notesQuery = `
          SELECT 
            n.note_id, n.customer_id, n.text, n.created_at, 
            n.assigned_day, n.source, n.is_completed, n.completed_at, n.priority,
            n.tags, n.is_read,
            c.AccountName as customer_name
          FROM 
            customer_notes n
          JOIN
            customers c ON n.customer_id = c.CustomerNumber
          WHERE 
            n.customer_id IN (${customerIds.map(() => '?').join(',')})
            AND (n.assigned_day = ? OR n.assigned_day IS NULL)
            AND (n.is_completed = 0 OR n.completed_at >= datetime('now', '-1 day'))
          ORDER BY 
            n.priority DESC, n.created_at DESC
        `;
        
        db.all(notesQuery, [...customerIds, today], (err, notes) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
              error: 'Server error',
              message: 'Error retrieving notes' 
            });
          }
          
          // Group notes by customer
          const notesByCustomer = {};
          customers.forEach(customer => {
            notesByCustomer[customer.CustomerNumber] = {
              customer: customer,
              notes: []
            };
          });
          
          notes.forEach(note => {
            if (notesByCustomer[note.customer_id]) {
              notesByCustomer[note.customer_id].notes.push(note);
            }
          });
          
          res.json({
            success: true,
            date: new Date().toISOString(),
            day: today,
            route_notes: routeNotesData,
            customerCount: customers.length,
            noteCount: notes.length + routeNotesData.length,
            customers: Object.values(notesByCustomer)
          });
        });
      });
    });
  } catch (err) {
    console.error('Get today notes error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error retrieving today\'s notes' 
    });
  }
};

/**
 * Create a new note for a customer
 */
const createNote = (req, res) => {
  try {
    const db = req.app.locals.db;
    const { 
      customer_id = null, // Now optional
      text, 
      assigned_day = null,
      source = 'manual',
      priority = 'normal',
      tags = null
    } = req.body;
    
    // Validate required fields
    if (!text) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Note text is required' 
      });
    }
    
    // If customer_id is provided, verify the customer exists and user has permission
    const checkPermissionAndInsert = (customerData = null) => {
      // Get the day of week if not provided
      let dayToUse = assigned_day;
      if (!dayToUse) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        dayToUse = days[new Date().getDay()];
      }
      
      // Insert the note
      const query = `
        INSERT INTO customer_notes (
          customer_id, text, assigned_day, source, priority, tags, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `;
      
      db.run(query, [customer_id, text, dayToUse, source, priority, tags], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Server error',
            message: 'Error creating note' 
          });
        }
        
        // Get the newly created note
        db.get(
          `SELECT 
            note_id, customer_id, text, created_at, assigned_day, 
            source, is_completed, completed_at, priority, tags, is_read
          FROM customer_notes 
          WHERE note_id = ?`,
          [this.lastID],
          (err, note) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ 
                error: 'Server error',
                message: 'Error retrieving created note' 
              });
            }
            
            // Log the activity if it's a customer note
            if (customer_id) {
              const activityQuery = `
                INSERT INTO customer_activity (
                  customer_id, activity_type, description, created_by, 
                  reference_id, reference_type
                ) VALUES (?, ?, ?, ?, ?, ?)
              `;
              
              db.run(
                activityQuery,
                [
                  customer_id,
                  'note',
                  `Note created: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
                  req.user.id || req.user.customerNumber,
                  this.lastID,
                  'note'
                ],
                (err) => {
                  if (err) {
                    console.error('Error logging activity:', err);
                    // Continue anyway, as the main data is inserted
                  }
                  
                  sendResponse(note, customerData);
                }
              );
            } else {
              // If it's a route-level note, no need to log customer activity
              sendResponse(note, customerData);
            }
          }
        );
      });
    };
    
    const sendResponse = (note, customerData) => {
      res.status(201).json({
        success: true,
        note,
        customer: customerData ? {
          id: customerData.CustomerNumber,
          name: customerData.AccountName
        } : null,
        message: 'Note created successfully'
      });
    };
    
    // If customer_id is provided, verify the customer
    if (customer_id) {
      let customerQuery = 'SELECT RouteNumber, AccountName, CustomerNumber FROM customers WHERE CustomerNumber = ?';
      
      db.get(customerQuery, [customer_id], (err, customer) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Server error',
            message: 'Error retrieving customer' 
          });
        }
        
        if (!customer) {
          return res.status(404).json({ 
            error: 'Not found',
            message: 'Customer not found' 
          });
        }
        
        // Non-SuperAdmin can only add notes for customers on their route
        if (req.user.role !== 'SuperAdmin' && customer.RouteNumber !== req.user.route) {
          return res.status(403).json({ 
            error: 'Permission denied',
            message: 'You do not have permission to add notes for this customer' 
          });
        }
        
        // Proceed with creating the note
        checkPermissionAndInsert(customer);
      });
    } else {
      // For route-level notes (no customer_id), proceed directly
      checkPermissionAndInsert();
    }
  } catch (err) {
    console.error('Create note error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error creating note' 
    });
  }
};

/**
 * Update a note
 */
const updateNote = (req, res) => {
  try {
    const db = req.app.locals.db;
    const noteId = req.params.noteId;
    const { 
      text, 
      assigned_day,
      is_completed,
      is_read,
      priority,
      tags
    } = req.body;
    
    // Verify the note exists and user has permission
    const noteQuery = `
      SELECT n.*, c.RouteNumber, c.AccountName
      FROM customer_notes n
      LEFT JOIN customers c ON n.customer_id = c.CustomerNumber
      WHERE n.note_id = ?
    `;
    
    db.get(noteQuery, [noteId], (err, note) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Server error',
          message: 'Error retrieving note' 
        });
      }
      
      if (!note) {
        return res.status(404).json({ 
          error: 'Not found',
          message: 'Note not found' 
        });
      }
      
      // Non-SuperAdmin can only edit notes for customers on their route or route-level notes
      if (note.customer_id && req.user.role !== 'SuperAdmin' && note.RouteNumber !== req.user.route) {
        return res.status(403).json({ 
          error: 'Permission denied',
          message: 'You do not have permission to edit this note' 
        });
      }
      
      // Build update query dynamically based on provided fields
      let updateFields = [];
      let updateParams = [];
      
      if (text !== undefined) {
        updateFields.push('text = ?');
        updateParams.push(text);
      }
      
      if (assigned_day !== undefined) {
        updateFields.push('assigned_day = ?');
        updateParams.push(assigned_day);
      }
      
      if (priority !== undefined) {
        updateFields.push('priority = ?');
        updateParams.push(priority);
      }
      
      if (tags !== undefined) {
        updateFields.push('tags = ?');
        updateParams.push(tags);
      }
      
      if (is_read !== undefined) {
        updateFields.push('is_read = ?');
        updateParams.push(is_read ? 1 : 0);
      }
      
      if (is_completed !== undefined) {
        updateFields.push('is_completed = ?');
        updateParams.push(is_completed ? 1 : 0);
        
        if (is_completed) {
          updateFields.push('completed_at = datetime("now")');
        } else {
          updateFields.push('completed_at = NULL');
        }
      }
      
      if (updateFields.length === 0) {
        return res.status(400).json({ 
          error: 'Invalid request',
          message: 'No fields to update' 
        });
      }
      
      // Add the note ID to params
      updateParams.push(noteId);
      
      // Execute the update
      const updateQuery = `
        UPDATE customer_notes 
        SET ${updateFields.join(', ')}
        WHERE note_id = ?
      `;
      
      db.run(updateQuery, updateParams, function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Server error',
            message: 'Error updating note' 
          });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ 
            error: 'Not found',
            message: 'Note not found or no changes made' 
          });
        }
        
        // Get the updated note
        db.get(
          `SELECT 
            note_id, customer_id, text, created_at, assigned_day, 
            source, is_completed, completed_at, priority, tags, is_read
          FROM customer_notes 
          WHERE note_id = ?`,
          [noteId],
          (err, updatedNote) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ 
                error: 'Server error',
                message: 'Error retrieving updated note' 
              });
            }
            
            // Log the activity if it's a customer note
            if (note.customer_id) {
              // Determine what changed for activity description
              let activityDesc = [];
              if (is_completed !== undefined) {
                activityDesc.push(is_completed ? 'marked as completed' : 'marked as incomplete');
              }
              if (is_read !== undefined) {
                activityDesc.push(is_read ? 'marked as read' : 'marked as unread');
              }
              if (text !== undefined) {
                activityDesc.push('text updated');
              }
              if (priority !== undefined) {
                activityDesc.push(`priority set to ${priority}`);
              }
              if (assigned_day !== undefined) {
                activityDesc.push(`assigned to ${assigned_day}`);
              }
              if (tags !== undefined) {
                activityDesc.push('tags updated');
              }
              
              const descriptionText = activityDesc.length > 0 
                ? `Note updated: ${activityDesc.join(', ')}` 
                : 'Note updated';
              
              const activityQuery = `
                INSERT INTO customer_activity (
                  customer_id, activity_type, description, created_by, 
                  reference_id, reference_type
                ) VALUES (?, ?, ?, ?, ?, ?)
              `;
              
              db.run(
                activityQuery,
                [
                  note.customer_id,
                  'note',
                  descriptionText,
                  req.user.id || req.user.customerNumber,
                  noteId,
                  'note'
                ],
                (err) => {
                  if (err) {
                    console.error('Error logging activity:', err);
                    // Continue anyway, as the main data is updated
                  }
                  
                  sendResponse(updatedNote, note);
                }
              );
            } else {
              // If it's a route-level note, no need to log customer activity
              sendResponse(updatedNote, note);
            }
          }
        );
      });
    });
    
    const sendResponse = (updatedNote, originalNote) => {
      res.json({
        success: true,
        note: updatedNote,
        customer: originalNote.customer_id ? {
          id: originalNote.customer_id,
          name: originalNote.AccountName
        } : null,
        message: 'Note updated successfully'
      });
    };
  } catch (err) {
    console.error('Update note error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error updating note' 
    });
  }
};

/**
 * Delete a note
 */
const deleteNote = (req, res) => {
  try {
    const db = req.app.locals.db;
    const noteId = req.params.noteId;
    
    // Verify the note exists and user has permission
    const noteQuery = `
      SELECT n.*, c.RouteNumber, c.AccountName
      FROM customer_notes n
      LEFT JOIN customers c ON n.customer_id = c.CustomerNumber
      WHERE n.note_id = ?
    `;
    
    db.get(noteQuery, [noteId], (err, note) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Server error',
          message: 'Error retrieving note' 
        });
      }
      
      if (!note) {
        return res.status(404).json({ 
          error: 'Not found',
          message: 'Note not found' 
        });
      }
      
      // SuperAdmin only can delete notes
      if (req.user.role !== 'SuperAdmin') {
        return res.status(403).json({ 
          error: 'Permission denied',
          message: 'You do not have permission to delete notes' 
        });
      }
      
      // Delete the note
      db.run('DELETE FROM customer_notes WHERE note_id = ?', [noteId], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Server error',
            message: 'Error deleting note' 
          });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ 
            error: 'Not found',
            message: 'Note not found' 
          });
        }
        
        // Log the activity if it was a customer note
        if (note.customer_id) {
          const activityQuery = `
            INSERT INTO customer_activity (
              customer_id, activity_type, description, created_by, 
              reference_id, reference_type
            ) VALUES (?, ?, ?, ?, ?, ?)
          `;
          
          db.run(
            activityQuery,
            [
              note.customer_id,
              'note',
              'Note deleted',
              req.user.id || req.user.customerNumber,
              noteId,
              'note'
            ],
            (err) => {
              if (err) {
                console.error('Error logging activity:', err);
                // Continue anyway, as the main data is deleted
              }
              
              res.json({
                success: true,
                customer: note.customer_id ? {
                  id: note.customer_id,
                  name: note.AccountName
                } : null,
                message: 'Note deleted successfully'
              });
            }
          );
        } else {
          // If it was a route-level note, no need to log customer activity
          res.json({
            success: true,
            message: 'Route note deleted successfully'
          });
        }
      });
    });
  } catch (err) {
    console.error('Delete note error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error deleting note' 
    });
  }
};

/**
 * Search for notes based on various criteria
 */
const searchNotes = (req, res) => {
  try {
    const db = req.app.locals.db;
    const { 
      q, // text search
      customer_id,
      day,
      completed,
      read,
      priority,
      tags,
      source,
      from_date,
      to_date,
      route // for filtering by route
    } = req.query;
    
    // Build the query with search parameters
    let query = `
      SELECT 
        n.note_id, n.customer_id, n.text, n.created_at, n.assigned_day, 
        n.source, n.is_completed, n.completed_at, n.priority, n.tags, n.is_read,
        c.AccountName as customer_name, c.RouteNumber as route_number
      FROM 
        customer_notes n
      LEFT JOIN
        customers c ON n.customer_id = c.CustomerNumber
      WHERE 1=1
    `;
    
    const queryParams = [];
    
    // Add filters if provided
    // Text search
    if (q) {
      query += ' AND n.text LIKE ?';
      queryParams.push(`%${q}%`);
    }
    
    // Customer ID filter
    if (customer_id) {
      query += ' AND n.customer_id = ?';
      queryParams.push(customer_id);
    }
    
    // Route filter
    if (route) {
      query += ' AND c.RouteNumber = ?';
      queryParams.push(route);
    }
    
    // Restrict to user's route if not SuperAdmin
    if (req.user.role !== 'SuperAdmin') {
      // Include route-level notes (no customer_id) or notes for customers on user's route
      query += ' AND (n.customer_id IS NULL OR c.RouteNumber = ?)';
      queryParams.push(req.user.route);
    }
    
    // Day filter
    if (day) {
      query += ' AND n.assigned_day = ?';
      queryParams.push(day);
    }
    
    // Completion status filter
    if (completed !== undefined) {
      query += ' AND n.is_completed = ?';
      queryParams.push(completed === 'true' || completed === '1' ? 1 : 0);
    }
    
    // Read status filter
    if (read !== undefined) {
      query += ' AND n.is_read = ?';
      queryParams.push(read === 'true' || read === '1' ? 1 : 0);
    }
    
    // Priority filter
    if (priority) {
      query += ' AND n.priority = ?';
      queryParams.push(priority);
    }
    
    // Tags filter
    if (tags) {
      query += ' AND n.tags LIKE ?';
      queryParams.push(`%${tags}%`);
    }
    
    // Source filter
    if (source) {
      query += ' AND n.source = ?';
      queryParams.push(source);
    }
    
    // Date range filters
    if (from_date) {
      query += ' AND n.created_at >= ?';
      queryParams.push(from_date);
    }
    
    if (to_date) {
      query += ' AND n.created_at <= ?';
      queryParams.push(to_date);
    }
    
    // Add ordering
    query += ' ORDER BY n.created_at DESC';
    
    // Execute the query
    db.all(query, queryParams, (err, notes) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Server error',
          message: 'Error searching notes' 
        });
      }
      
      res.json({
        success: true,
        count: notes.length,
        notes
      });
    });
  } catch (err) {
    console.error('Search notes error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error searching notes' 
    });
  }
};

module.exports = {
  getCustomerNotes,
  getTodayNotes,
  createNote,
  updateNote,
  deleteNote,
  searchNotes
};