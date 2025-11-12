// Mac Installation Instructions
// Used by InstallAddInModal in components.react.js

export const macInstallInstructions = {
  title: '🍎 Mac Installation Guide',
  
  steps: [
    {
      id: 'step1',
      title: 'Step 1: Locate the Downloaded Installer',
      description: 'Find the WordFTW-Add-in-Installer.pkg file in your Downloads folder:',
      image: '/1-download-folder.png',
      imageAlt: 'Downloaded installer in Downloads folder',
      backgroundColor: '#f9fafb',
      borderColor: '#e5e7eb',
      textColor: '#1f2937'
    },
    {
      id: 'step2',
      title: 'Step 2: Security Warning',
      description: 'When you double-click the installer, macOS will show a security warning because this package is from an unidentified developer. This is normal for downloaded installers.',
      image: '/2-download-error.png',
      imageAlt: 'Security warning dialog',
      backgroundColor: '#f9fafb',
      borderColor: '#e5e7eb',
      textColor: '#1f2937'
    },
    {
      id: 'step3',
      title: 'Step 3: Approve in System Settings',
      description: 'Go to System Settings → Privacy & Security and click "Open Anyway" to approve the installer:',
      image: '/3-security-approval.png',
      imageAlt: 'Security approval in System Settings',
      backgroundColor: '#f9fafb',
      borderColor: '#e5e7eb',
      textColor: '#1f2937'
    },
    {
      id: 'step4',
      title: 'Step 4: Confirm Installation',
      description: 'Click "Open" when macOS asks you to confirm:',
      image: '/4-install-confirmation.png',
      imageAlt: 'Installation confirmation dialog',
      backgroundColor: '#f9fafb',
      borderColor: '#e5e7eb',
      textColor: '#1f2937'
    },
    {
      id: 'step5',
      title: 'Step 5: Grant App Access',
      description: 'The installer will ask for permission to access your files. Click "OK" to allow:',
      image: '/5-app-access.png',
      imageAlt: 'App access permission dialog',
      backgroundColor: '#f9fafb',
      borderColor: '#e5e7eb',
      textColor: '#1f2937'
    },
    {
      id: 'step6',
      title: 'Step 6: Word Opens Automatically',
      description: 'After installation completes, Word will open automatically with a sample document:',
      image: '/6-initial-doc.png',
      imageAlt: 'Word opens with document',
      backgroundColor: '#f9fafb',
      borderColor: '#e5e7eb',
      textColor: '#1f2937'
    },
    {
      id: 'step7',
      title: 'Step 7: Open the Add-in',
      description: 'Go to Insert → My Add-ins, look under "Shared Folder", and select "OpenGov Contracting":',
      image: '/7-open-add-in.png',
      imageAlt: 'Opening the add-in in Word',
      backgroundColor: '#f0fdf4',
      borderColor: '#86efac',
      textColor: '#15803d'
    }
  ],
  
  linkCodeSection: {
    title: 'Your Link Code',
    description: 'Copy this code to link the add-in with your browser session:',
    instructions: [
      'Click the 3 dots menu (⋮) at the top of the add-in panel',
      'Select "Enter Link Code"',
      'Paste this code and click "Submit"',
      'The add-in will connect to your browser'
    ],
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    textColor: '#1e40af'
  },
  
  buttonText: {
    copy: '📋 Copy Code',
    copied: '✓ Copied!',
    done: 'Done'
  }
};

