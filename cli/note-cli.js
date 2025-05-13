#!/usr/bin/env node
// note-cli.js - CLI tool for creating and viewing notes

const axios = require('axios');
const readline = require('readline');
const chalk = require('chalk');
const figlet = require('figlet');
const { program } = require('commander');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Setup axios defaults
const API_URL = process.env.API_URL || 'http://localhost:5000';
let token = process.env.API_TOKEN || '';

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Setup axios interceptor for auth
axios.interceptors.request.use(
  config => {
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Helper function to prompt user for input
const prompt = (question) => new Promise((resolve) => {
  rl.question(question, answer => resolve(answer));
});

// Display welcome message
const displayWelcome = () => {
  console.log(
    chalk.blue(
      figlet.textSync('R33IS', { horizontalLayout: 'fitted' })
    )
  );
  console.log(chalk.yellow('Route 33 Intelligence System - Note CLI'));
  console.log(chalk.yellow('='.repeat(50)));
};

// Login function
const login = async () => {
  try {
    console.log(chalk.green('\nLogin to access R33IS API'));
    
    const username = await prompt('Username: ');
    const password = await prompt('Password: ');
    
    const response = await axios.post(`${API_URL}/api/auth/login`, { 
      username, 
      password 
    });
    
    if (response.data.token) {
      token = response.data.token;
      console.log(chalk.green(`\nWelcome, ${response.data.user.name}!`));
      return response.data.user;
    }
  } catch (err) {
    console.error(chalk.red('Login failed:'), err.response?.data?.message || err.message);
    process.exit(1);
  }
};

// Get today's notes
const getTodayNotes = async () => {
  try {
    const response = await axios.get(`${API_URL}/api/notes/today`);
    const { customers, route_notes, date, day, customerCount, noteCount } = response.data;
    
    console.log(chalk.blue(`\n📝 Notes for ${day} (${new Date(date).toLocaleDateString()})`));
    console.log(chalk.blue(`Found ${noteCount} notes for ${customerCount} customers\n`));
    
    // Show route-level notes if any
    if (route_notes && route_notes.length > 0) {
      console.log(chalk.green(`\n📍 ROUTE NOTES:`));
      route_notes.forEach(note => {
        const status = note.is_completed 
          ? chalk.gray('[✓] ') 
          : note.priority === 'high' 
            ? chalk.red('[!] ') 
            : chalk.blue('[ ] ');
        
        console.log(`  ${status}${note.text}`);
        console.log(`    ${chalk.gray(`Added: ${new Date(note.created_at).toLocaleString()} • Source: ${note.source}`)}`);
        if (note.tags) {
          console.log(`    ${chalk.cyan(`Tags: ${note.tags}`)}`);
        }
      });
    }
    
    if (customers.length === 0 && (!route_notes || route_notes.length === 0)) {
      console.log(chalk.yellow('No notes or scheduled customers for today'));
      return;
    }
    
    // Show customer notes
    customers.forEach(({ customer, notes }) => {
      console.log(chalk.green(`\n📍 ${customer.AccountName} (${customer.CustomerNumber})`));
      
      if (notes.length === 0) {
        console.log(chalk.yellow('  No notes for this customer'));
      } else {
        notes.forEach(note => {
          const status = note.is_completed 
            ? chalk.gray('[✓] ') 
            : note.priority === 'high' 
              ? chalk.red('[!] ') 
              : chalk.blue('[ ] ');
          
          const readStatus = note.is_read
            ? chalk.gray(' [Read]')
            : chalk.yellow(' [Unread]');
          
          console.log(`  ${status}${note.text}${readStatus}`);
          console.log(`    ${chalk.gray(`Added: ${new Date(note.created_at).toLocaleString()} • Source: ${note.source}`)}`);
          if (note.tags) {
            console.log(`    ${chalk.cyan(`Tags: ${note.tags}`)}`);
          }
        });
      }
    });
  } catch (err) {
    console.error(chalk.red('Error getting notes:'), err.response?.data?.message || err.message);
  }
};

// Get notes for a specific customer
const getCustomerNotes = async (customerId) => {
  try {
    const response = await axios.get(`${API_URL}/api/notes/customer/${customerId}`);
    const { notes } = response.data;
    
    // Get customer name
    const customerResponse = await axios.get(`${API_URL}/api/customers/${customerId}`);
    const customer = customerResponse.data;
    
    console.log(chalk.blue(`\n📝 Notes for ${customer.AccountName} (${customer.CustomerNumber})\n`));
    
    if (notes.length === 0) {
      console.log(chalk.yellow('No notes for this customer'));
      return;
    }
    
    notes.forEach(note => {
      const status = note.is_completed 
        ? chalk.gray('[✓] ') 
        : note.priority === 'high' 
          ? chalk.red('[!] ') 
          : chalk.blue('[ ] ');
      
      const readStatus = note.is_read
        ? chalk.gray(' [Read]')
        : chalk.yellow(' [Unread]');
      
      console.log(`${status}${note.text}${readStatus}`);
      console.log(`  ${chalk.gray(`Day: ${note.assigned_day || 'Any'} • Added: ${new Date(note.created_at).toLocaleString()} • Source: ${note.source}`)}`);
      if (note.tags) {
        console.log(`  ${chalk.cyan(`Tags: ${note.tags}`)}`);
      }
      console.log(chalk.gray('-'.repeat(50)));
    });
  } catch (err) {
    console.error(chalk.red('Error getting notes:'), err.response?.data?.message || err.message);
  }
};

// Search notes
const searchNotes = async () => {
  try {
    console.log(chalk.blue('\n🔍 Search Notes'));
    
    const searchTerm = await prompt('Search text (or press Enter to skip): ');
    const customerIdInput = await prompt('Customer ID (or press Enter to skip): ');
    const tagInput = await prompt('Tags (or press Enter to skip): ');
    const dayInput = await prompt('Day (Monday-Sunday, or press Enter for any): ');
    const sourceInput = await prompt('Source (manual, nfc, gps, voice, call, ai, or press Enter for any): ');
    const completedInput = await prompt('Completed (y/n, or press Enter for any): ');
    const readInput = await prompt('Read (y/n, or press Enter for any): ');
    
    // Build query params
    const params = {};
    if (searchTerm) params.q = searchTerm;
    if (customerIdInput) params.customer_id = customerIdInput;
    if (tagInput) params.tags = tagInput;
    if (dayInput) params.day = dayInput;
    if (sourceInput) params.source = sourceInput;
    if (completedInput === 'y') params.completed = 'true';
    if (completedInput === 'n') params.completed = 'false';
    if (readInput === 'y') params.read = 'true';
    if (readInput === 'n') params.read = 'false';
    
    // Make the search request
    const response = await axios.get(`${API_URL}/api/notes/search`, { params });
    const { notes, count } = response.data;
    
    console.log(chalk.green(`\nFound ${count} notes matching your search criteria:`));
    
    if (count === 0) {
      console.log(chalk.yellow('No matching notes found'));
      return;
    }
    
    notes.forEach(note => {
      const status = note.is_completed 
        ? chalk.gray('[✓] ') 
        : note.priority === 'high' 
          ? chalk.red('[!] ') 
          : chalk.blue('[ ] ');
      
      const readStatus = note.is_read
        ? chalk.gray(' [Read]')
        : chalk.yellow(' [Unread]');
      
      console.log(`\n${status}${note.text}${readStatus}`);
      
      if (note.customer_id) {
        console.log(`  ${chalk.green(`Customer: ${note.customer_name} (${note.customer_id})`)}`);
      } else {
        console.log(`  ${chalk.green('Route-level note')}`);
      }
      
      console.log(`  ${chalk.gray(`Day: ${note.assigned_day || 'Any'} • Added: ${new Date(note.created_at).toLocaleString()} • Source: ${note.source}`)}`);
      if (note.tags) {
        console.log(`  ${chalk.cyan(`Tags: ${note.tags}`)}`);
      }
      console.log(chalk.gray('-'.repeat(50)));
    });
  } catch (err) {
    console.error(chalk.red('Error searching notes:'), err.response?.data?.message || err.message);
  }
};

// Create a new note
const createNote = async () => {
  try {
    // First ask for the customer
    console.log(chalk.blue('\n📝 Create a new note'));
    
    // Ask if this is a route-level note
    const isRouteNote = await prompt('Is this a route-level note (not specific to a customer)? (y/n): ');
    let customer_id = null;
    let customerName = null;
    
    if (isRouteNote.toLowerCase() !== 'y') {
      // Prompt for search term to find customer
      const searchTerm = await prompt('Search for customer (name or number): ');
      
      // Search for customer
      const customersResponse = await axios.get(`${API_URL}/api/customers?search=${searchTerm}`);
      const { customers } = customersResponse.data;
      
      if (customers.length === 0) {
        console.log(chalk.yellow('No customers found matching that search'));
        return;
      }
      
      // Display customers
      console.log(chalk.green('\nCustomers found:'));
      customers.forEach((customer, index) => {
        console.log(`${index + 1}. ${customer.AccountName} (${customer.CustomerNumber})`);
      });
      
      // Choose customer
      const customerIndex = parseInt(await prompt('\nSelect customer number: '), 10) - 1;
      
      if (customerIndex < 0 || customerIndex >= customers.length) {
        console.log(chalk.red('Invalid selection'));
        return;
      }
      
      const selectedCustomer = customers[customerIndex];
      customer_id = selectedCustomer.CustomerNumber;
      customerName = selectedCustomer.AccountName;
    }
    
    // Get note text
    const text = await prompt(`\nEnter note${customer_id ? ` for ${customerName}` : ' for route'}: `);
    
    if (!text.trim()) {
      console.log(chalk.red('Note text cannot be empty'));
      return;
    }
    
    // Get priority
    const priorityOption = await prompt('Priority (l=low, n=normal, h=high) [n]: ');
    let priority = 'normal';
    
    if (priorityOption === 'l') priority = 'low';
    else if (priorityOption === 'h') priority = 'high';
    
    // Get day
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const todayIndex = new Date().getDay();
    const today = days[todayIndex === 0 ? 6 : todayIndex - 1]; // Adjust for 0-indexed (Sunday = 0)
    
    const dayOption = await prompt(`Assign to day (${days.join(', ')}) [${today}]: `);
    const assigned_day = dayOption && days.includes(dayOption) ? dayOption : today;
    
    // Get tags
    const tags = await prompt('Tags (comma-separated): ');
    
    // Create the note
    const response = await axios.post(`${API_URL}/api/notes`, {
      customer_id,
      text,
      assigned_day,
      priority,
      tags: tags || null,
      source: 'cli'
    });
    
    console.log(chalk.green('\nNote created successfully!'));
    console.log(chalk.blue(`For: ${customer_id ? customerName : 'Route'}`));
    console.log(chalk.blue(`Day: ${assigned_day}`));
    console.log(chalk.blue(`Priority: ${priority}`));
    if (tags) console.log(chalk.blue(`Tags: ${tags}`));
    console.log(chalk.blue(`Text: ${text}`));
  } catch (err) {
    console.error(chalk.red('Error creating note:'), err.response?.data?.message || err.message);
  }
};

// Mark a note as completed
const completeNote = async (noteId) => {
  try {
    // Update the note
    await axios.put(`${API_URL}/api/notes/${noteId}`, {
      is_completed: true
    });
    
    console.log(chalk.green('Note marked as completed!'));
  } catch (err) {
    console.error(chalk.red('Error completing note:'), err.response?.data?.message || err.message);
  }
};

// Mark a note as read
const markNoteAsRead = async (noteId) => {
  try {
    // Update the note
    await axios.put(`${API_URL}/api/notes/${noteId}`, {
      is_read: true
    });
    
    console.log(chalk.green('Note marked as read!'));
  } catch (err) {
    console.error(chalk.red('Error marking note as read:'), err.response?.data?.message || err.message);
  }
};

// Export notes to JSON or TXT
const exportNotes = async (format = 'json') => {
  try {
    console.log(chalk.blue(`\n📤 Exporting today's notes in ${format.toUpperCase()} format`));
    
    // Get today's notes
    const response = await axios.get(`${API_URL}/api/notes/today`);
    const { customers, route_notes, date, day } = response.data;
    
    // Prepare output directory
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `notes_${day}_${timestamp}.${format}`;
    const filePath = path.join(exportDir, fileName);
    
    if (format === 'json') {
      // Export as JSON
      fs.writeFileSync(filePath, JSON.stringify({
        date,
        day,
        route_notes: route_notes || [],
        customers
      }, null, 2));
    } else {
      // Export as TXT
      let content = `ROUTE 33 NOTES - ${day.toUpperCase()} (${new Date(date).toLocaleDateString()})\n`;
      content += '='.repeat(50) + '\n\n';
      
      // Add route notes
      if (route_notes && route_notes.length > 0) {
        content += 'ROUTE NOTES:\n';
        route_notes.forEach(note => {
          content += `[${note.is_completed ? '✓' : ' '}] ${note.text}\n`;
          content += `    Day: ${note.assigned_day || 'Any'} • Added: ${new Date(note.created_at).toLocaleString()} • Source: ${note.source}\n`;
          if (note.tags) content += `    Tags: ${note.tags}\n`;
          content += '\n';
        });
      }
      
      // Add customer notes
      customers.forEach(({ customer, notes }) => {
        content += `\n${customer.AccountName} (${customer.CustomerNumber}):\n`;
        content += '-'.repeat(50) + '\n';
        
        if (notes.length === 0) {
          content += '  No notes for this customer\n';
        } else {
          notes.forEach(note => {
            content += `[${note.is_completed ? '✓' : ' '}] ${note.text} ${note.is_read ? '[Read]' : '[Unread]'}\n`;
            content += `    Day: ${note.assigned_day || 'Any'} • Added: ${new Date(note.created_at).toLocaleString()} • Source: ${note.source}\n`;
            if (note.tags) content += `    Tags: ${note.tags}\n`;
            content += '\n';
          });
        }
      });
      
      fs.writeFileSync(filePath, content);
    }
    
    console.log(chalk.green(`\nNotes exported to: ${filePath}`));
  } catch (err) {
    console.error(chalk.red('Error exporting notes:'), err.response?.data?.message || err.message);
  }
};

// Main function
const main = async () => {
  displayWelcome();
  
  // Setup command line arguments
  program
    .version('1.0.0')
    .description('Route 33 Intelligence System CLI for notes')
    
  program
    .command('today')
    .description('Get notes for today\'s customers')
    .action(async () => {
      await login();
      await getTodayNotes();
      rl.close();
    });
    
  program
    .command('customer <id>')
    .description('Get notes for a specific customer')
    .action(async (id) => {
      await login();
      await getCustomerNotes(id);
      rl.close();
    });
    
  program
    .command('search')
    .description('Search notes with filters')
    .action(async () => {
      await login();
      await searchNotes();
      rl.close();
    });
    
  program
    .command('create')
    .description('Create a new note')
    .action(async () => {
      await login();
      await createNote();
      rl.close();
    });
    
  program
    .command('complete <id>')
    .description('Mark a note as completed')
    .action(async (id) => {
      await login();
      await completeNote(id);
      rl.close();
    });
    
  program
    .command('read <id>')
    .description('Mark a note as read')
    .action(async (id) => {
      await login();
      await markNoteAsRead(id);
      rl.close();
    });
    
  program
    .command('export [format]')
    .description('Export today\'s notes to JSON or TXT (default: JSON)')
    .action(async (format = 'json') => {
      await login();
      await exportNotes(format.toLowerCase());
      rl.close();
    });
    
  // Interactive mode if no command provided
  if (process.argv.length <= 2) {
    await login();
    
    console.log(chalk.blue('\n📌 R33IS Note CLI - Interactive Mode'));
    console.log(chalk.yellow('1. View today\'s notes'));
    console.log(chalk.yellow('2. View notes for a customer'));
    console.log(chalk.yellow('3. Search notes'));
    console.log(chalk.yellow('4. Create a new note'));
    console.log(chalk.yellow('5. Mark a note as completed'));
    console.log(chalk.yellow('6. Mark a note as read'));
    console.log(chalk.yellow('7. Export today\'s notes to JSON'));
    console.log(chalk.yellow('8. Export today\'s notes to TXT'));
    console.log(chalk.yellow('0. Exit'));
    
    const choice = await prompt('\nSelect an option: ');
    
    switch (choice) {
      case '1':
        await getTodayNotes();
        break;
      case '2':
        const customerId = await prompt('Enter customer ID: ');
        await getCustomerNotes(customerId);
        break;
      case '3':
        await searchNotes();
        break;
      case '4':
        await createNote();
        break;
      case '5':
        const noteIdToComplete = await prompt('Enter note ID: ');
        await completeNote(noteIdToComplete);
        break;
      case '6':
        const noteIdToRead = await prompt('Enter note ID: ');
        await markNoteAsRead(noteIdToRead);
        break;
      case '7':
        await exportNotes('json');
        break;
      case '8':
        await exportNotes('txt');
        break;
      case '0':
        console.log(chalk.blue('Goodbye!'));
        break;
      default:
        console.log(chalk.red('Invalid option'));
    }
    
    rl.close();
  } else {
    program.parse(process.argv);
  }
};

// Start the CLI
main().catch(err => {
  console.error(chalk.red('Error:'), err);
  rl.close();
  process.exit(1);
});