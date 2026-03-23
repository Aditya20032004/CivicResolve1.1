import React, { useState } from 'react';
import { api, endpoints } from '../lib/api';
import { Camera, MapPin, Upload, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

interface CitizenViewProps {
  onBack: () => void;
}

const CitizenView: React.FC<CitizenViewProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('23.2599');
  const [lng, setLng] = useState('77.4126');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error', msg: string, id?: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setResult(null);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toFixed(4));
          setLng(position.coords.longitude.toFixed(4));
          setAddress(`Location: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Could not get your location. Using default.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setResult({ type: 'error', msg: 'Please select an image to upload' });
      return;
    }

    if (!address.trim()) {
      setResult({ type: 'error', msg: 'Please provide a location/address' });
      return;
    }

    setSubmitting(true);
    setResult(null);

    const formData = new FormData();
    formData.append('image', file, file.name);
    formData.append('lat', lat);
    formData.append('lng', lng);
    formData.append('address', address);

    try {
      const response = await api.post(endpoints.citizen.report, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const detectedType = response.data.detected_type || 'issue';
      const autoSeverity = response.data.auto_severity || null;

      const parts: string[] = [];
      parts.push(`Your ${detectedType} report has been registered.`);
      if (autoSeverity) {
        parts.push(`AI estimated severity as ${autoSeverity}.`);
      }

      setResult({
        type: 'success',
        msg: `Report submitted successfully! ${parts.join(' ')}`,
        id: response.data.id
      });

      // Reset form
      setTimeout(() => {
        setFile(null);
        setPreview(null);
        setAddress('');
        setResult(null);
      }, 3000);

    } catch (err: any) {
      console.error('Report submission error:', err);
      const errorMsg = err.response?.data?.error || 'Failed to submit report. Please try again.';
      setResult({ type: 'error', msg: errorMsg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Camera className="w-6 h-6 text-blue-400" />
              Report an Issue
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8 shadow-2xl"
        >
          <div className="space-y-8">
            {/* Image Upload */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">
                Upload Photo
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-slate-600 transition-colors bg-slate-800/30"
                >
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="w-12 h-12 text-slate-500 mb-3" />
                      <span className="text-slate-400 text-sm font-medium">Click to upload image</span>
                      <span className="text-slate-600 text-xs mt-1">PNG, JPG up to 10MB</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-3">
                Location
              </label>
              <div className="space-y-3">
                <button
                  onClick={getCurrentLocation}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <MapPin className="w-4 h-4" />
                  Use Current Location
                </button>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter address or landmark"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="Latitude"
                    className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="Longitude"
                    className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Result Message */}
            {result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-4 rounded-xl flex items-start gap-3 ${
                  result.type === 'success'
                    ? 'bg-green-500/10 border border-green-500/30'
                    : 'bg-red-500/10 border border-red-500/30'
                }`}
              >
                {result.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-medium ${result.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {result.msg}
                  </p>
                  {result.id && (
                    <p className="text-xs text-slate-400 mt-1">Report ID: #{result.id}</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !file}
              className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
                submitting || !file
                  ? 'bg-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-900/50'
              }`}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting Report...
                </span>
              ) : (
                'Submit Report'
              )}
            </button>
          </div>
        </motion.div>

        {/* Info Section */}
        <div className="mt-8 p-6 bg-slate-800/30 border border-slate-700 rounded-xl">
          <h3 className="text-lg font-bold text-white mb-3">How it works</h3>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">1.</span>
              <span>Upload a clear photo of the issue</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">2.</span>
              <span>AI will auto-detect if it is a pothole or garbage</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">3.</span>
              <span>Add location details (or use current location)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">4.</span>
              <span>AI will verify your report and create a ticket automatically</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CitizenView;
