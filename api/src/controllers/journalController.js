// src/controllers/journalController.js
// Controller for journal functionality

/**
 * Get all journal entries for a customer
 */
const getCustomerJournal = (req, res) => {
  try {
    const db = req.app.locals.db;
    const customerId = req.params.customerId;
    const { entry_type, from_date, to_date, sentiment, tags } = req.query;
    
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
          entry_id, customer_id, entry_type, content, created_at,
          location, service_day, related_items, sentiment, sentiment_score,
          tags, source
        FROM 
          journal_entries
        WHERE 
          customer_id = ?
      `;
      
      const queryParams = [customerId];
      
      // Add filters if provided
      if (entry_type) {
        query += ' AND entry_type = ?';
        queryParams.push(entry_type);
      }
      
      if (sentiment) {
        query += ' AND sentiment = ?';
        queryParams.push(sentiment);
      }
      
      if (tags) {
        query += ' AND tags LIKE ?';
        queryParams.push(`%${tags}%`);
      }
      
      if (from_date) {
        query += ' AND created_at >= ?';
        queryParams.push(from_date);
      }
      
      if (to_date) {
        query += ' AND created_at <= ?';
        queryParams.push(to_date);
      }
      
      // Add ordering
      query += ' ORDER BY created_at DESC';
      
      db.all(query, queryParams, (err, entries) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Server error',
            message: 'Error retrieving journal entries' 
          });
        }
        
        res.json({ 
          success: true, 
          customer_id: customerId,
          count: entries.length,
          entries 
        });
      });
    });
  } catch (err) {
    console.error('Get journal entries error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error retrieving journal entries' 
    });
  }
};

/**
 * Get journal entries for today's route
 */
const getTodayJournal = (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Get the current day of the week
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    
    // Get the user's route if not SuperAdmin
    const userRoute = req.user.role !== 'SuperAdmin' ? req.user.route : null;
    
    // Query for today's customers
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
      
      if (customers.length === 0) {
        return res.json({ 
          success: true,
          date: new Date().toISOString(),
          day: today,
          customers: [], 
          entries: [] 
        });
      }
      
      // Get all customer IDs
      const customerIds = customers.map(c => c.CustomerNumber);
      
      // Query for journal entries for these customers
      const entriesQuery = `
        SELECT 
          j.entry_id, j.customer_id, j.entry_type, j.content, j.created_at,
          j.location, j.service_day, j.related_items, j.sentiment, j.sentiment_score,
          j.tags, j.source,
          c.AccountName as customer_name
        FROM 
          journal_entries j
        JOIN
          customers c ON j.customer_id = c.CustomerNumber
        WHERE 
          j.customer_id IN (${customerIds.map(() => '?').join(',')})
        ORDER BY 
          j.created_at DESC
        LIMIT 100
      `;
      
      db.all(entriesQuery, customerIds, (err, entries) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            error: 'Server error',
            message: 'Error retrieving journal entries' 
          });
        }
        
        // Group entries by customer
        const entriesByCustomer = {};
        customers.forEach(customer => {
          entriesByCustomer[customer.CustomerNumber] = {
            customer: customer,
            entries: []
          };
        });
        
        entries.forEach(entry => {
          if (entriesByCustomer[entry.customer_id]) {
            entriesByCustomer[entry.customer_id].entries.push(entry);
          }
        });
        
        res.json({
          success: true,
          date: new Date().toISOString(),
          day: today,
          customerCount: customers.length,
          entryCount: entries.length,
          customers: Object.values(entriesByCustomer)
        });
      });
    });
  } catch (err) {
    console.error('Get today journal entries error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error retrieving today\'s journal entries' 
    });
  }
};

/**
 * Create a new journal entry
 */
const createJournalEntry = (req, res) => {
  try {
    const db = req.app.locals.db;
    const { 
      customer_id, 
      entry_type = 'observation',
      content, 
      location = null,
      service_day = null,
      related_items = null,
      tags = null,
      source = 'manual'
    } = req.body;
    
    // Validate required fields
    if (!customer_id || !content) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Customer ID and content are required' 
      });
    }
    
    // Check entry_type is valid
    const validTypes = ['observation', 'request', 'issue', 'followup', 'other'];
    if (!validTypes.includes(entry_type)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: `Entry type must be one of: ${validTypes.join(', ')}`
      });
    }
    
    // Verify the customer exists and user has permission
    let customerQuery = 'SELECT RouteNumber, AccountName FROM customers WHERE CustomerNumber = ?';
    
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
      
      // Non-SuperAdmin can only add journal entries for customers on their route
      if (req.user.role !== 'SuperAdmin' && customer.RouteNumber !== req.user.route) {
        return res.status(403).json({ 
          error: 'Permission denied',
          message: 'You do not have permission to add journal entries for this customer' 
        });
      }
      
      // Get the day of week if not provided
      let dayToUse = service_day;
      if (!dayToUse) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        dayToUse = days[new Date().getDay()];
      }
      
      // TODO: Basic sentiment analysis - could be expanded with AI integration
      let sentiment = 'neutral';
      let sentimentScore = 0;
      
      // Simple keyword-based sentiment analysis
      const positiveWords = ['good', 'great', 'excellent', 'happy', 'pleased', 'satisfied', 'thanks'];
      const negativeWords = ['bad', 'poor', 'issue', 'problem', 'unhappy', 'disappointed', 'complaint'];
      
      const contentLower = content.toLowerCase();
      let positiveCount = 0;
      let negativeCount = 0;
      
      positiveWords.forEach(word => {
        if (contentLower.includes(word)) positiveCount++;
      });
      
      negativeWords.forEach(word => {
        if (contentLower.includes(word)) negativeCount++;
      });
      
      if (positiveCount > negativeCount) {
        sentiment = 'positive';
        sentimentScore = 0.5 + (positiveCount - negativeCount) * 0.1;
        if (sentimentScore > 1) sentimentScore = 1;
      } else if (negativeCount > positiveCount) {
        sentiment = 'negative';
        sentimentScore = -0.5 - (negativeCount - positiveCount) * 0.1;
        if (sentimentScore < -1) sentimentScore = -1;
      }
      
      // Process related items (convert to JSON string if needed)
      let relatedItemsJson = related_items;
      if (related_items && typeof related_items !== 'string') {
        relatedItemsJson = JSON.stringify(related_items);
      }
      
      // Insert the journal entry
      const query = `
        INSERT INTO journal_entries (
          customer_id, entry_type, content, created_at, location,
          service_day, related_items, sentiment, sentiment_score, 
          tags, source
        ) VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?)
      `;
      
      db.run(
        query, 
        [
          customer_id, 
          entry_type, 
          content, 
          location, 
          dayToUse, 
          relatedItemsJson,
          sentiment,
          sentimentScore,
          tags,
          source
        ], 
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ 
              error: 'Server error',
              message: 'Error creating journal entry' 
            });
          }
          
          // Get the newly created entry
          db.get(
            `SELECT 
              entry_id, customer_id, entry_type, content, created_at, location,
              service_day, related_items, sentiment, sentiment_score, 
              tags, source
            FROM journal_entries 
            WHERE entry_id = ?`,
            [this.lastID],
            (err, entry) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ 
                  error: 'Server error',
                  message: 'Error retrieving created journal entry' 
                });
              }
              
              // Log the activity
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
                  'journal',
                  `Journal entry created: ${entry_type}`,
                  req.user.id || req.user.customerNumber,
                  this.lastID,
                  'journal'
                ],
                (err) => {
                  if (err) {
                    console.error('Error logging activity:', err);
                    // Continue anyway, as the main data is inserted
                  }
                  
                  res.status(201).json({
                    success: true,
                    entry,
                    customer: {
                      id: customer_id,
                      name: customer.AccountName
                    },
                    message: 'Journal entry created successfully'
                  });
                }
              );
            }
          );
        }
      );
    });
  } catch (err) {
    console.error('Create journal entry error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error creating journal entry' 
    });
  }
};

/**
 * Search for journal entries based on various criteria
 */
const searchJournal = (req, res) => {
  try {
    const db = req.app.locals.db;
    const { 
      q, // text search
      customer_id,
      entry_type,
      sentiment,
      tags,
      source,
      service_day,
      from_date,
      to_date,
      route // for filtering by route
    } = req.query;
    
    // Build the query with search parameters
    let query = `
      SELECT 
        j.entry_id, j.customer_id, j.entry_type, j.content, j.created_at,
        j.location, j.service_day, j.related_items, j.sentiment, j.sentiment_score,
        j.tags, j.source,
        c.AccountName as customer_name, c.RouteNumber as route_number
      FROM 
        journal_entries j
      JOIN
        customers c ON j.customer_id = c.CustomerNumber
      WHERE 1=1
    `;
    
    const queryParams = [];
    
    // Add filters if provided
    // Text search
    if (q) {
      query += ' AND j.content LIKE ?';
      queryParams.push(`%${q}%`);
    }
    
    // Customer ID filter
    if (customer_id) {
      query += ' AND j.customer_id = ?';
      queryParams.push(customer_id);
    }
    
    // Route filter
    if (route) {
      query += ' AND c.RouteNumber = ?';
      queryParams.push(route);
    }
    
    // Restrict to user's route if not SuperAdmin
    if (req.user.role !== 'SuperAdmin') {
      query += ' AND c.RouteNumber = ?';
      queryParams.push(req.user.route);
    }
    
    // Entry type filter
    if (entry_type) {
      query += ' AND j.entry_type = ?';
      queryParams.push(entry_type);
    }
    
    // Sentiment filter
    if (sentiment) {
      query += ' AND j.sentiment = ?';
      queryParams.push(sentiment);
    }
    
    // Service day filter
    if (service_day) {
      query += ' AND j.service_day = ?';
      queryParams.push(service_day);
    }
    
    // Tags filter
    if (tags) {
      query += ' AND j.tags LIKE ?';
      queryParams.push(`%${tags}%`);
    }
    
    // Source filter
    if (source) {
      query += ' AND j.source = ?';
      queryParams.push(source);
    }
    
    // Date range filters
    if (from_date) {
      query += ' AND j.created_at >= ?';
      queryParams.push(from_date);
    }
    
    if (to_date) {
      query += ' AND j.created_at <= ?';
      queryParams.push(to_date);
    }
    
    // Add ordering
    query += ' ORDER BY j.created_at DESC';
    
    // Execute the query
    db.all(query, queryParams, (err, entries) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ 
          error: 'Server error',
          message: 'Error searching journal entries' 
        });
      }
      
      res.json({
        success: true,
        count: entries.length,
        entries
      });
    });
  } catch (err) {
    console.error('Search journal entries error:', err);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Error searching journal entries' 
    });
  }
};

module.exports = {
  getCustomerJournal,
  getTodayJournal,
  createJournalEntry,
  searchJournal
};