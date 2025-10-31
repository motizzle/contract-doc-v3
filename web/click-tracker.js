/**
 * Optional Click Tracking Script
 * 
 * Add to any page to track user clicks:
 * <script src="/web/click-tracker.js"></script>
 * 
 * Tracks:
 * - Button clicks
 * - Link clicks
 * - Any element with data-track="click" attribute
 * 
 * Privacy-focused: Only tracks elements you mark for tracking
 */

(function() {
  'use strict';
  
  const TRACK_ALL = false; // Set to true to track ALL clicks (can be overwhelming!)
  const API_ENDPOINT = '/api/analytics/click';
  
  // Send click event to server
  function trackClick(eventData) {
    // Don't track in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('[Click Tracker] Skipping (localhost):', eventData);
      return;
    }
    
    // Send asynchronously (don't block user)
    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
      // Use keepalive to ensure request completes even if page unloads
      keepalive: true
    }).catch(err => {
      console.error('[Click Tracker] Error:', err);
    });
  }
  
  // Get element description
  function getElementDescription(element) {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className ? `.${element.className.split(' ').join('.')}` : '';
    const text = element.textContent ? element.textContent.trim().substring(0, 50) : '';
    
    return {
      tag,
      selector: `${tag}${id}${classes}`,
      text,
      href: element.href || element.getAttribute('data-href') || null
    };
  }
  
  // Should we track this element?
  function shouldTrack(element) {
    if (!element) return false;
    
    // Always track elements explicitly marked for tracking
    if (element.hasAttribute('data-track')) {
      return true;
    }
    
    // If TRACK_ALL enabled, track buttons and links
    if (TRACK_ALL) {
      if (element.tagName === 'BUTTON') return true;
      if (element.tagName === 'A') return true;
    }
    
    return false;
  }
  
  // Handle click event
  function handleClick(event) {
    let element = event.target;
    
    // Walk up DOM tree to find trackable element
    let depth = 0;
    while (element && depth < 5) {
      if (shouldTrack(element)) {
        const description = getElementDescription(element);
        const eventData = {
          page: window.location.pathname,
          element: description,
          timestamp: new Date().toISOString(),
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
          scrollY: window.scrollY
        };
        
        trackClick(eventData);
        break;
      }
      element = element.parentElement;
      depth++;
    }
  }
  
  // Initialize tracking
  function init() {
    console.log('[Click Tracker] Initialized', {
      trackAll: TRACK_ALL,
      mode: TRACK_ALL ? 'Track all buttons/links' : 'Track marked elements only'
    });
    
    // Add click listener to document
    document.addEventListener('click', handleClick, true);
    
    // Log tracked elements for debugging
    if (!TRACK_ALL) {
      const tracked = document.querySelectorAll('[data-track]');
      console.log(`[Click Tracker] Found ${tracked.length} marked elements`);
    }
  }
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Expose API for manual tracking
  window.analyticsTrack = function(eventName, customData) {
    trackClick({
      page: window.location.pathname,
      eventName,
      customData,
      timestamp: new Date().toISOString()
    });
  };
  
})();

