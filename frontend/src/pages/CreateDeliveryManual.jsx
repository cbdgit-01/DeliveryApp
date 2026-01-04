import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tasksAPI, uploadsAPI } from '../services/api';
import './CreateTask.css';

const CreateDeliveryManual = () => {
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
    delivery_address_line1: '',
    delivery_address_line2: '',
    delivery_city: '',
    delivery_state: 'IN',
    delivery_zip: '',
    item_title: '',
    item_description: '',
    sku: '',
    delivery_notes: '',
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
      const taskData = {
        source: 'in_store',
        sku: formData.sku || 'MANUAL-' + Date.now(),
        liberty_item_id: 'MANUAL-' + Date.now(),
        item_title: formData.item_title,
        item_description: formData.item_description,
        // Use first image as main image_url
        image_url: formData.item_photos.length > 0 ? formData.item_photos[0] : '',
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email,
        delivery_address_line1: formData.delivery_address_line1,
        delivery_address_line2: formData.delivery_address_line2,
        delivery_city: formData.delivery_city,
        delivery_state: formData.delivery_state,
        delivery_zip: formData.delivery_zip,
        // Include additional photos in notes if more than 1
        delivery_notes: formData.item_photos.length > 1 
          ? `${formData.delivery_notes}\n\nAdditional Photos:\n${formData.item_photos.slice(1).join('\n')}`.trim()
          : formData.delivery_notes,
      };

      const response = await tasksAPI.create(taskData);
      setSuccess(true);
      
      setTimeout(() => {
        navigate(`/tasks/${response.data.id}`);
      }, 1500);
      
    } catch (err) {
      console.error('Error creating delivery:', err);
      setError(err.response?.data?.detail || 'Failed to create delivery');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-task-new">
      <div className="page-header-new">
        <h1>New Delivery</h1>
        <p>Manually create a delivery ticket</p>
      </div>

      {success && (
        <div className="success-banner">
          Delivery created successfully!
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

          {/* Item Information */}
          <div className="form-section-new">
            <h2>Item Information</h2>
            
            <div className="form-grid">
              <div className="form-group-new full-width">
                <label htmlFor="item_title">Item Title *</label>
                <input
                  id="item_title"
                  name="item_title"
                  type="text"
                  value={formData.item_title}
                  onChange={handleChange}
                  placeholder="Antique Oak Dresser"
                  required
                />
              </div>

              <div className="form-group-new">
                <label htmlFor="sku">SKU / Item ID (Optional)</label>
                <input
                  id="sku"
                  name="sku"
                  type="text"
                  value={formData.sku}
                  onChange={handleChange}
                  placeholder="1234-567"
                />
              </div>

              <div className="form-group-new full-width">
                <label htmlFor="item_description">Item Description (Optional)</label>
                <textarea
                  id="item_description"
                  name="item_description"
                  value={formData.item_description}
                  onChange={handleChange}
                  placeholder="Additional details about the item..."
                  rows="3"
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

          {/* Delivery Notes */}
          <div className="form-section-new">
            <h2>Delivery Notes (Optional)</h2>
            <div className="form-group-new">
              <textarea
                id="delivery_notes"
                name="delivery_notes"
                value={formData.delivery_notes}
                onChange={handleChange}
                placeholder="Gate code, parking instructions, stairs, special handling needs, etc."
                rows="4"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="form-actions-new">
            <button
              type="submit"
              className="btn-submit-new"
              disabled={loading || uploading}
            >
              {loading ? 'Creating Delivery...' : 'Create Delivery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDeliveryManual;
