const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  userType: {
    type: String,
    enum: ['freelancer', 'business', 'service_provider', 'admin'],
    required: [true, 'User type is required']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  },
  
  // Freelancer Profile Fields
  freelancerProfile: {
    name: {
      type: String,
      trim: true
    },
    expertise: {
      type: String,
      trim: true
    },
    yearsExperience: {
      type: String,
      enum: ['0-1', '1-3', '3-5', '5-10', '10+']
    },
    pastProjects: {
      type: String
    },
    portfolioLinks: {
      type: String
    },
    hourlyRate: {
      type: Number,
      min: 0
    },
    availability: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'hourly', 'not-available']
    },
    profilePicture: {
      type: String
    },
    bio: {
      type: String
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    reviewCount: {
      type: Number,
      default: 0
    },
    stripeAccountId: {
      type: String,
      default: null
    },
    stripeStatus: {
      type: String,
      enum: ['pending', 'enabled', 'disabled'],
      default: 'pending'
    },
    payoutsEnabled: {
      type: Boolean,
      default: false
    }
  },
  
  // Business Profile Fields
  businessProfile: {
    businessName: {
      type: String,
      trim: true
    },
    industry: {
      type: String,
      enum: ['technology', 'retail', 'healthcare', 'finance', 'manufacturing', 'education', 'hospitality', 'other']
    },
    companySize: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '500+']
    },
    goals: {
      type: String
    },
    requiredSkills: {
      type: String
    },
    website: {
      type: String
    },
    description: {
      type: String
    },
    contactPerson: {
      type: String
    },
    phone: {
      type: String
    },
    address: {
      type: String
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    reviewCount: {
      type: Number,
      default: 0
    }
  },

  // Provider Profile Fields
  serviceProviderProfile: {
    companyName: {
      type: String,
      trim: true
    },
    websiteUrl: {
      type: String,
      trim: true
    },
    industryFocus: {
      type: [String],
      default: []
    },
    integrations: {
      type: [String],
      default: []
    },
    description: {
      type: String
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    reviewCount: {
      type: Number,
      default: 0
    },
    stripeAccountId: {
      type: String,
      default: null
    },
    stripeStatus: {
      type: String,
      enum: ['pending', 'enabled', 'disabled'],
      default: 'pending'
    },
    payoutsEnabled: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error(error);
  }
};

// Method to get public profile (without password)
UserSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

const User = mongoose.model('User', UserSchema);

module.exports = User;
