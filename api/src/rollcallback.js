// Save this as search-backend-roles.js and run with Node.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define the roles to search for (backend lowercase versions)
const roles = ['superadmin', 'admin', 'driver', 'customer'];

// Define directories to exclude
const excludeDirs = ['node_modules', 'build', 'dist', '.git'];

// Root directory for your backend project
const rootDir = '/home/xoom000/mission_api/api/src'; // Change this to your backend root path

// Helper function to check if a path should be excluded
const shouldExclude = (p) => {
  return excludeDirs.some(dir => p.includes(`/${dir}/`) || p.endsWith(`/${dir}`));
};

// Alternative approach using grep if available
function searchWithGrep() {
  try {
    const results = {};
    
    roles.forEach(role => {
      console.log(`Searching for "${role}" references...`);
      try {
        // Using grep to search for role strings
        const grepCommand = `grep -r --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" -n "\\b${role}\\b" ${rootDir} | grep -v "node_modules\\|build\\|dist"`;
        const output = execSync(grepCommand, { encoding: 'utf8' });
        
        // Process the grep output
        const lines = output.split('\n').filter(Boolean);
        console.log(`Found ${lines.length} occurrences of "${role}"`);
        
        results[role] = lines.map(line => {
          const [file, lineNum, ...contextParts] = line.split(':');
          return {
            file,
            lineNumber: lineNum,
            context: contextParts.join(':').trim()
          };
        });
      } catch (error) {
        // grep returns non-zero exit code if no matches found
        if (error.status !== 1) {
          console.error(`Error searching for ${role}:`, error.message);
        }
        results[role] = [];
      }
    });
    
    return results;
  } catch (error) {
    console.log('Grep not available or error occurred, falling back to JavaScript implementation');
    return null;
  }
}

// Function to get all JavaScript files recursively
function getJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !shouldExclude(filePath)) {
      results = results.concat(getJsFiles(filePath));
    } else if (
      stat.isFile() && 
      (filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.ts') || filePath.endsWith('.tsx'))
    ) {
      results.push(filePath);
    }
  });
  
  return results;
}

// Function to search for roles in a file
function searchRolesInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const results = [];
  
  roles.forEach(role => {
    const regex = new RegExp(`\\b${role}\\b`, 'g');
    let match;
    while ((match = regex.exec(content)) !== null) {
      // Get the line number
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      // Get the context (the line containing the match)
      const lines = content.split('\n');
      const context = lines[lineNumber - 1].trim();
      
      results.push({
        role,
        lineNumber,
        context
      });
    }
  });
  
  return results;
}

// Main execution
console.log('Analyzing backend role usage...');

// Try grep first if on Unix-like system
const grepResults = searchWithGrep();

if (grepResults) {
  // Display results from grep
  console.log('\nResults Summary:');
  let totalOccurrences = 0;
  
  roles.forEach(role => {
    const occurrences = grepResults[role] ? grepResults[role].length : 0;
    totalOccurrences += occurrences;
    console.log(`- "${role}": ${occurrences} occurrences`);
  });
  
  console.log(`\nTotal: ${totalOccurrences} role references found`);
  
  // Save detailed results to file
  const detailedResults = roles.map(role => {
    return {
      role,
      occurrences: grepResults[role] || []
    };
  });
  
  fs.writeFileSync('backend-role-search-results.json', JSON.stringify(detailedResults, null, 2));
  console.log('\nDetailed results saved to backend-role-search-results.json');
} else {
  // Use JavaScript implementation
  console.log('Searching for JavaScript files...');
  const files = getJsFiles(rootDir);
  console.log(`Found ${files.length} files to scan`);

  const results = {};
  let totalOccurrences = 0;

  roles.forEach(role => {
    results[role] = [];
  });

  files.forEach(file => {
    const fileResults = searchRolesInFile(file);
    
    fileResults.forEach(result => {
      results[result.role].push({
        file,
        lineNumber: result.lineNumber,
        context: result.context
      });
    });
  });

  console.log('\nResults Summary:');
  roles.forEach(role => {
    const occurrences = results[role].length;
    totalOccurrences += occurrences;
    console.log(`- "${role}": ${occurrences} occurrences`);
  });

  console.log(`\nTotal: ${totalOccurrences} role references found`);
  
  // Save detailed results to file
  const detailedResults = roles.map(role => {
    return {
      role,
      occurrences: results[role]
    };
  });
  
  fs.writeFileSync('backend-role-search-results.json', JSON.stringify(detailedResults, null, 2));
  console.log('\nDetailed results saved to backend-role-search-results.json');
}
