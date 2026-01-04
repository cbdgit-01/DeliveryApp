import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { pickupsAPI, uploadsAPI } from '../services/api';
import './CreateTask.css'; // Reuse CreateTask styles

const CreatePickup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    pickup_address_line1: '',
    pickup_address_line2: '',
    pickup_city: '',
    pickup_state: 'IN',
    pickup_zip: '',
    item_description: '',
    item_count: 1,
    pickup_notes: '',
    item_photos: [],
  });
  
  const [imagePreviews, setImagePreviews] = useState([]);

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

  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // Limit to 10 total images
    const totalImages = formData.item_photos.length + files.length;
    if (totalImages > 10) {
      setError('Maximum 10 images allowed');
      return;
    }
    
    setUploading(true);
    setError('');
    
    try {
      const response = await uploadsAPI.uploadImages(files);
      const newUrls = response.data.urls;
      
      // Add to form data
      setFormData(prev => ({
        ...prev,
        item_photos: [...prev.item_photos, ...newUrls]
      }));
      
      // Add previews
      const newPreviews = files.map((file, index) => ({
        url: newUrls[index],
        name: file.name
      }));
      setImagePreviews(prev => [...prev, ...newPreviews]);
      
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload images. Please try again.');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      item_photos: prev.item_photos.filter((_, i) => i !== index)
    }));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'customer_phone') {
      const formatted = formatPhoneNumber(value);
      setFormData(prev => ({
        ...prev,
        [name]: formatted
      }));
    } else if (name === 'item_count') {
      setFormData(prev => ({
        ...prev,
        [name]: parseInt(value) || 1
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
      await pickupsAPI.create(formData);
      setSuccess(true);
      
      // Navigate to pickups dashboard after success
      setTimeout(() => {
        navigate('/pickups');
      }, 1500);
    } catch (err) {
      console.error('Error creating pickup:', err);
      setError(err.response?.data?.detail || 'Failed to create pickup request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-task-new">
      <div className="page-header-new">
        <h1>New Pickup Request</h1>
        <p>Enter customer and item information</p>
      </div>

      {success && (
        <div className="success-banner">
          ✓ Pickup request created successfully!
        </div>
      )}

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="form-container-new">
        <form onSubmit={handleSubmit} className="delivery-form">
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

          {/* Pickup Address */}
          <div className="form-section-new">
            <h2>Pickup Address</h2>
            
            <div className="form-grid">
              <div className="form-group-new full-width">
                <label htmlFor="pickup_address_line1">Street Address *</label>
                <input
                  id="pickup_address_line1"
                  name="pickup_address_line1"
                  type="text"
                  value={formData.pickup_address_line1}
                  onChange={handleChange}
                  placeholder="123 Main Street"
                  required
                />
              </div>

              <div className="form-group-new full-width">
                <label htmlFor="pickup_address_line2">Apt, Suite, etc. (Optional)</label>
                <input
                  id="pickup_address_line2"
                  name="pickup_address_line2"
                  type="text"
                  value={formData.pickup_address_line2}
                  onChange={handleChange}
                  placeholder="Apt 4B"
                />
              </div>

              <div className="form-group-new">
                <label htmlFor="pickup_city">City *</label>
                <input
                  id="pickup_city"
                  name="pickup_city"
                  type="text"
                  value={formData.pickup_city}
                  onChange={handleChange}
                  placeholder="Indianapolis"
                  required
                />
              </div>

              <div className="form-group-new">
                <label htmlFor="pickup_state">State *</label>
                <select
                  id="pickup_state"
                  name="pickup_state"
                  value={formData.pickup_state}
                  onChange={handleChange}
                  required
                >
                  <option value="IN">Indiana</option>
                </select>
              </div>

              <div className="form-group-new">
                <label htmlFor="pickup_zip">ZIP Code *</label>
                <input
                  id="pickup_zip"
                  name="pickup_zip"
                  type="text"
                  value={formData.pickup_zip}
                  onChange={handleChange}
                  placeholder="46201"
                  required
                />
              </div>
            </div>
          </div>

          {/* Item Information */}
          <div className="form-section-new">
            <h2>Item Information</h2>
            
            <div className="form-grid">
              <div className="form-group-new full-width">
                <label htmlFor="item_description">Item Description *</label>
                <textarea
                  id="item_description"
                  name="item_description"
                  value={formData.item_description}
                  onChange={handleChange}
                  placeholder="Describe the items for pickup (furniture type, condition, size, etc.)"
                  rows="4"
                  required
                />
              </div>

              <div className="form-group-new">
                <label htmlFor="item_count">Estimated Number of Items</label>
                <input
                  id="item_count"
                  name="item_count"
                  type="number"
                  min="1"
                  value={formData.item_count}
                  onChange={handleChange}
                />
              </div>

              {/* Image Upload */}
              <div className="form-group-new full-width">
                <label>Item Photos (Optional - up to 10 images)</label>
                <div className="image-upload-area">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="upload-button">
                    {uploading ? 'Uploading...' : 'Add Photos'}
                  </label>
                  <span className="upload-hint">
                    {formData.item_photos.length}/10 photos added
                  </span>
                </div>
                
                {imagePreviews.length > 0 && (
                  <div className="image-previews">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="image-preview-item">
                        <img src={preview.url} alt={`Preview ${index + 1}`} />
                        <button
                          type="button"
                          className="remove-image-btn"
                          onClick={() => removeImage(index)}
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pickup Notes */}
          <div className="form-section-new">
            <h2>Pickup Notes (Optional)</h2>
            <div className="form-group-new">
              <textarea
                id="pickup_notes"
                name="pickup_notes"
                value={formData.pickup_notes}
                onChange={handleChange}
                placeholder="Gate code, parking instructions, availability, special handling needs, etc."
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
              {loading ? 'Creating Pickup...' : 'Create Pickup Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePickup;

