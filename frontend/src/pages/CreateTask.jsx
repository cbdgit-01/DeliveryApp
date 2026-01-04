import React, { useState, useEffect } from 'react';
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
  const [itemFound, setItemFound] = useState(false);

  // Block keyboard shortcuts at document level to prevent scanner interference
  // Scanners sometimes send Ctrl+Shift+B which opens Firefox Library
  useEffect(() => {
    const blockShortcuts = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (['b', 'B', 'o', 'O', 'h', 'H', 'p', 'P'].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    };
    
    document.addEventListener('keydown', blockShortcuts, true);
    return () => document.removeEventListener('keydown', blockShortcuts, true);
  }, []);
  
  const [formData, setFormData] = useState({
    source: 'in_store',
    sku: '',
    liberty_item_id: '',
    item_title: '',
    item_description: '',
    image_url: '',
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
        // Check availability
        if (!response.data.available) {
          const status = response.data.inventory_status;
          const statusMsg = status?.status === 'sold' 
            ? 'This item has been sold.' 
            : 'This item is not available.';
          setError(`${statusMsg} Please check the item and try again.`);
          setItemFound(false);
          return;
        }
        
        const item = response.data.item;
        setFormData(prev => ({
          ...prev,
          sku: item.sku,
          liberty_item_id: item.liberty_item_id,
          item_title: item.title,
          item_description: item.description || '',
          image_url: item.image_url || '',
        }));
        setItemFound(true);
        setError('');
      } else {
        setError(response.data.message || 'Item not found');
        setItemFound(false);
      }
    } catch (err) {
      console.error('Error looking up item:', err);
      setError('Failed to lookup item. Please enter details manually.');
      setItemFound(false);
    } finally {
      setLookingUp(false);
    }
  };

  // Prevent keyboard shortcuts that interfere with barcode scanning
  // Firefox Ctrl+Shift+B opens Library, scanners sometimes send modifier keys
  const handleKeyDown = (e) => {
    // Block common browser shortcuts that scanners might trigger
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      // Ctrl+Shift+B (Firefox Library), Ctrl+Shift+O (Firefox Bookmarks)
      if (['b', 'o', 'h', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };

  const formatPhoneNumber = (value) => {
    // Remove all non-digits
    const phoneNumber = value.replace(/\D/g, '');
    
    // Format as XXX-XXX-XXXX
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
    
    // Auto-format phone number
    if (name === 'customer_phone') {
      const formatted = formatPhoneNumber(value);
      setFormData(prev => ({
        ...prev,
        [name]: formatted
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await tasksAPI.create(formData);
      setSuccess(true);
      
      // For staff, show success and reset form
      if (isStaff()) {
        setTimeout(() => {
          setSuccess(false);
          setItemFound(false);
          setSkuInput('');
          setFormData({
            source: 'in_store',
            sku: '',
            liberty_item_id: '',
            item_title: '',
            item_description: '',
            image_url: '',
            customer_name: '',
            customer_phone: '',
            customer_email: '',
            delivery_address_line1: '',
            delivery_address_line2: '',
            delivery_city: '',
            delivery_state: 'CA',
            delivery_zip: '',
            delivery_notes: '',
          });
        }, 2000);
      } else {
        // For admin, navigate to task detail
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
    setItemFound(false);
    setSkuInput('');
    setFormData(prev => ({
      ...prev,
      sku: '',
      liberty_item_id: '',
      item_title: '',
      item_description: '',
      image_url: '',
    }));
  };

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
        {/* Step 1: Item Lookup */}
        {!itemFound ? (
          <div className="lookup-section">
            <div className="lookup-card">
              <div className="scan-icon">📦</div>
              <h2>Scan Item</h2>
              <p>Scan barcode or enter SKU/Item ID</p>
              
              <form onSubmit={handleSkuLookup} className="lookup-form">
                <input
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
            ← Back to Scan
          </button>
          {/* Step 2: Item Found - Show Details & Customer Form */}
          <form onSubmit={handleSubmit} className="delivery-form">
            {/* Item Preview */}
            <div className="item-preview-card">
              <div className="item-preview-header">
                <div className="item-preview-info">
                  {formData.image_url && (
                    <img src={formData.image_url} alt={formData.item_title} className="item-preview-image" />
                  )}
                  <div>
                    <h3>{formData.item_title}</h3>
                    <p className="item-sku">SKU: {formData.sku}</p>
                  </div>
                </div>
                <button type="button" onClick={handleReset} className="btn-change">
                  Change Item
                </button>
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
                    autoFocus
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
                    placeholder="(555) 123-4567"
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
                    placeholder="San Francisco"
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
                    placeholder="94102"
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
                disabled={loading}
              >
                {loading ? 'Creating Delivery...' : 'Create Delivery'}
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
