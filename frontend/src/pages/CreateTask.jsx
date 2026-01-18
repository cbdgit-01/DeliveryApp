import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tasksAPI, itemsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './CreateTask.css';

const CreateTask = () => {
  const navigate = useNavigate();
  const { isStaff } = useAuth();
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [skuInput, setSkuInput] = useState('');
  const [items, setItems] = useState([]); // Multiple items support
  const [addingMore, setAddingMore] = useState(false); // Show scan input for additional items
  const [soldWarning, setSoldWarning] = useState(false);
  const skuInputRef = useRef(null);

  // Block keyboard shortcuts at document level to prevent scanner interference
  useEffect(() => {
    const blockShortcuts = (e) => {
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (['j', 'b', 'o', 'h', 'd', 'p', 's'].includes(key)) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    };
    
    document.addEventListener('keydown', blockShortcuts, true);
    window.addEventListener('keydown', blockShortcuts, true);
    return () => {
      document.removeEventListener('keydown', blockShortcuts, true);
      window.removeEventListener('keydown', blockShortcuts, true);
    };
  }, []);

  // Auto-focus SKU input when adding more items
  useEffect(() => {
    if (addingMore && skuInputRef.current) {
      skuInputRef.current.focus();
    }
  }, [addingMore]);
  
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    delivery_address_line1: '',
    delivery_address_line2: '',
    delivery_city: '',
    delivery_state: 'IN',
    delivery_zip: '',
    delivery_notes: '',
  });

  const handleSkuLookup = async (e) => {
    e.preventDefault();
    if (!skuInput.trim()) return;

    setLookingUp(true);
    setError('');

    try {
      const response = await itemsAPI.lookup(skuInput.trim());
      
      if (response.data.found) {
        const item = response.data.item;
        const status = response.data.inventory_status;
        
        // Show warning if item shows as sold/unavailable
        const isSold = !response.data.available || status?.status === 'sold' || status?.status === 'unavailable';
        if (isSold) {
          setSoldWarning(true);
        }
        
        // Add item to list
        const newItem = {
          sku: item.sku,
          item_id: item.liberty_item_id,
          title: item.title,
          description: item.description || '',
          image_url: item.image_url || '',
        };
        
        setItems(prev => [...prev, newItem]);
        setSkuInput('');
        setAddingMore(false);
        setError('');
      } else {
        setError(response.data.message || 'Item not found');
      }
    } catch (err) {
      console.error('Error looking up item:', err);
      setError('Failed to lookup item. Please try again.');
    } finally {
      setLookingUp(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      if (['b', 'o', 'h', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };

  const formatPhoneNumber = (value) => {
    const phoneNumber = value.replace(/\D/g, '');
    if (phoneNumber.length <= 3) {
      return phoneNumber;
    } else if (phoneNumber.length <= 6) {
      return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
    } else {
      return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'customer_phone') {
      const formatted = formatPhoneNumber(value);
      setFormData(prev => ({ ...prev, [name]: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) {
      setError('Please add at least one item');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      // Build item title summary
      const itemTitle = items.length === 1 
        ? items[0].title 
        : `${items.length} Items: ${items.map(i => i.title).join(', ').substring(0, 100)}`;
      
      const taskData = {
        source: 'in_store',
        // Primary item fields (for backwards compatibility)
        sku: items[0].sku,
        liberty_item_id: items[0].item_id,
        item_title: itemTitle,
        item_description: items.length > 1 
          ? items.map(i => `• ${i.title} (SKU: ${i.sku})`).join('\n')
          : items[0].description,
        image_url: items[0].image_url,
        // Multiple items array
        items: items,
        // Customer & delivery info
        ...formData,
      };

      const response = await tasksAPI.create(taskData);
      setSuccess(true);
      
      if (isStaff()) {
        setTimeout(() => {
          setSuccess(false);
          setItems([]);
          setSoldWarning(false);
          setFormData({
            customer_name: '',
            customer_phone: '',
            customer_email: '',
            delivery_address_line1: '',
            delivery_address_line2: '',
            delivery_city: '',
            delivery_state: 'IN',
            delivery_zip: '',
            delivery_notes: '',
          });
        }, 2000);
      } else {
        navigate(`/tasks/${response.data.id}`);
      }
    } catch (err) {
      console.error('Error creating task:', err);
      setError(err.response?.data?.detail || 'Failed to create delivery');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setItems([]);
    setSoldWarning(false);
    setSkuInput('');
    setAddingMore(false);
  };

  const hasItems = items.length > 0;

  return (
    <div className="create-task-new">
      <div className="page-header-new">
        <h1>New Delivery</h1>
        <p>Scan or enter item SKU to get started</p>
      </div>

      {success && (
        <div className="success-banner">
          ✓ Delivery created successfully! The scheduler has been notified.
        </div>
      )}

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="form-container-new">
        {/* Step 1: No items yet - show scan interface */}
        {!hasItems ? (
          <div className="lookup-section">
            <div className="lookup-card">
              <div className="scan-icon">📦</div>
              <h2>Scan Item</h2>
              <p>Scan barcode or enter SKU/Item ID</p>
              
              <form onSubmit={handleSkuLookup} className="lookup-form">
                <input
                  ref={skuInputRef}
                  type="text"
                  value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter SKU or Item ID"
                  className="sku-input"
                  autoFocus
                  disabled={lookingUp}
                />
                <button 
                  type="submit" 
                  className="btn-lookup"
                  disabled={lookingUp || !skuInput.trim()}
                >
                  {lookingUp ? 'Looking up...' : 'Lookup Item'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <>
          <button type="button" onClick={handleReset} className="back-link">
            ← Start Over
          </button>
          
          {soldWarning && (
            <div className="warning-banner">
              ⚠ One or more items show as sold in Shopify — if you just sold them, proceed below
            </div>
          )}
          
          {/* Step 2: Items added - Show list & customer form */}
          <form onSubmit={handleSubmit} className="delivery-form">
            {/* Items List */}
            <div className="form-section-new">
              <div className="section-header-with-action">
                <h2>Items ({items.length})</h2>
                {!addingMore && (
                  <button 
                    type="button" 
                    className="btn-add-item"
                    onClick={() => setAddingMore(true)}
                  >
                    + Add Another Item
                  </button>
                )}
              </div>
              
              {/* Add More Items Input */}
              {addingMore && (
                <div className="add-item-inline">
                  <input
                    ref={skuInputRef}
                    type="text"
                    value={skuInput}
                    onChange={(e) => setSkuInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Scan or enter SKU"
                    className="sku-input-inline"
                    disabled={lookingUp}
                  />
                  <button 
                    type="button"
                    className="btn-lookup-inline"
                    onClick={handleSkuLookup}
                    disabled={lookingUp || !skuInput.trim()}
                  >
                    {lookingUp ? '...' : 'Add'}
                  </button>
                  <button 
                    type="button"
                    className="btn-cancel-inline"
                    onClick={() => { setAddingMore(false); setSkuInput(''); }}
                  >
                    Cancel
                  </button>
                </div>
              )}
              
              {/* Items Grid */}
              <div className="items-list">
                {items.map((item, index) => (
                  <div key={index} className="item-card">
                    {item.image_url && (
                      <img src={item.image_url} alt={item.title} className="item-card-image" />
                    )}
                    <div className="item-card-info">
                      <h4>{item.title}</h4>
                      <p className="item-card-sku">SKU: {item.sku}</p>
                    </div>
                    <button 
                      type="button" 
                      className="item-remove-btn"
                      onClick={() => removeItem(index)}
                      title="Remove item"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Information */}
            <div className="form-section-new">
              <h2>Customer Information</h2>
              
              <div className="form-grid">
                <div className="form-group-new">
                  <label htmlFor="customer_name">Customer Name *</label>
                  <input
                    id="customer_name"
                    name="customer_name"
                    type="text"
                    value={formData.customer_name}
                    onChange={handleChange}
                    placeholder="John Smith"
                    required
                  />
                </div>

                <div className="form-group-new">
                  <label htmlFor="customer_phone">Phone Number *</label>
                  <input
                    id="customer_phone"
                    name="customer_phone"
                    type="tel"
                    value={formData.customer_phone}
                    onChange={handleChange}
                    placeholder="555-123-4567"
                    required
                  />
                </div>

                <div className="form-group-new full-width">
                  <label htmlFor="customer_email">Email (Optional)</label>
                  <input
                    id="customer_email"
                    name="customer_email"
                    type="email"
                    value={formData.customer_email}
                    onChange={handleChange}
                    placeholder="customer@example.com"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="form-section-new">
              <h2>Delivery Address</h2>
              
              <div className="form-grid">
                <div className="form-group-new full-width">
                  <label htmlFor="delivery_address_line1">Street Address *</label>
                  <input
                    id="delivery_address_line1"
                    name="delivery_address_line1"
                    type="text"
                    value={formData.delivery_address_line1}
                    onChange={handleChange}
                    placeholder="123 Main Street"
                    required
                  />
                </div>

                <div className="form-group-new full-width">
                  <label htmlFor="delivery_address_line2">Apt, Suite, etc. (Optional)</label>
                  <input
                    id="delivery_address_line2"
                    name="delivery_address_line2"
                    type="text"
                    value={formData.delivery_address_line2}
                    onChange={handleChange}
                    placeholder="Apt 4B"
                  />
                </div>

                <div className="form-group-new">
                  <label htmlFor="delivery_city">City *</label>
                  <input
                    id="delivery_city"
                    name="delivery_city"
                    type="text"
                    value={formData.delivery_city}
                    onChange={handleChange}
                    placeholder="Indianapolis"
                    required
                  />
                </div>

                <div className="form-group-new">
                  <label htmlFor="delivery_state">State *</label>
                  <select
                    id="delivery_state"
                    name="delivery_state"
                    value={formData.delivery_state}
                    onChange={handleChange}
                    required
                  >
                    <option value="IN">Indiana</option>
                  </select>
                </div>

                <div className="form-group-new">
                  <label htmlFor="delivery_zip">ZIP Code *</label>
                  <input
                    id="delivery_zip"
                    name="delivery_zip"
                    type="text"
                    value={formData.delivery_zip}
                    onChange={handleChange}
                    placeholder="46201"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Delivery Notes */}
            <div className="form-section-new">
              <h2>Delivery Notes (Optional)</h2>
              <div className="form-group-new">
                <textarea
                  id="delivery_notes"
                  name="delivery_notes"
                  value={formData.delivery_notes}
                  onChange={handleChange}
                  placeholder="Gate code, parking instructions, stairs, special handling, etc."
                  rows="4"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="form-actions-new">
              <button
                type="submit"
                className="btn-submit-new"
                disabled={loading || items.length === 0}
              >
                {loading ? 'Creating Delivery...' : `Create Delivery (${items.length} item${items.length > 1 ? 's' : ''})`}
              </button>
            </div>
          </form>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateTask;
