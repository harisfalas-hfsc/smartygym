import React from 'react';
import { Building2, Dumbbell, Target, Calculator, Sparkles, ClipboardCheck, Users, Trophy, Star, CheckCircle, Shield, BarChart3 } from 'lucide-react';

export const CorporateBrochure = () => {
  return (
    <div className="min-h-screen bg-white text-gray-900 print:text-black" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Page 1 */}
      <div className="p-8 md:p-12 max-w-[21cm] mx-auto" style={{ minHeight: '29.7cm', pageBreakAfter: 'always' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b-4 border-[#29B6D2] pb-6">
          <div className="flex items-center gap-4">
            <img 
              src="/smarty-gym-logo.png" 
              alt="SmartyGym Logo" 
              className="h-16 w-16 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div>
              <h1 className="text-3xl font-bold text-[#29B6D2]">SmartyGym</h1>
              <p className="text-sm text-gray-600">Corporate Wellness Solutions</p>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-[#1a1a1a] text-white px-4 py-2 rounded-lg flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#29B6D2]" />
              <span className="text-[#29B6D2] font-bold">Smarty Corporate</span>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a] text-white rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4">Empower Your Team with Expert-Designed Fitness</h2>
          <p className="text-gray-300 mb-4">
            SmartyGym Corporate brings professional-grade fitness and wellness to your organization. 
            Every program is designed by Sports Scientist <strong className="text-[#29B6D2]">Haris Falas</strong>, 
            ensuring your team receives genuine coaching expertise—not generic AI content.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-6 text-center">
            <div>
              <p className="text-3xl font-bold text-[#29B6D2]">500+</p>
              <p className="text-sm text-gray-400">Expert Workouts</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#29B6D2]">20+</p>
              <p className="text-sm text-gray-400">Years Experience</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#29B6D2]">100%</p>
              <p className="text-sm text-gray-400">Human Expertise</p>
            </div>
          </div>
        </div>

        {/* Corporate Benefits */}
        <h3 className="text-xl font-bold mb-6 text-[#29B6D2] border-b-2 border-[#29B6D2] pb-2">Why Corporate Wellness?</h3>
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-[#29B6D2]">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-5 w-5 text-[#29B6D2]" />
              <h4 className="font-bold">Increased Productivity</h4>
            </div>
            <p className="text-sm text-gray-600">Active employees are 21% more productive and take fewer sick days.</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-[#29B6D2]">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-[#29B6D2]" />
              <h4 className="font-bold">Team Building</h4>
            </div>
            <p className="text-sm text-gray-600">Shared fitness goals build stronger teams and improve morale.</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-[#29B6D2]">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-[#29B6D2]" />
              <h4 className="font-bold">Reduced Healthcare Costs</h4>
            </div>
            <p className="text-sm text-gray-600">Preventive wellness programs reduce long-term healthcare expenses.</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-[#29B6D2]">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-5 w-5 text-[#29B6D2]" />
              <h4 className="font-bold">Employee Retention</h4>
            </div>
            <p className="text-sm text-gray-600">Wellness benefits attract and retain top talent in competitive markets.</p>
          </div>
        </div>

        {/* Platform Features */}
        <h3 className="text-xl font-bold mb-6 text-[#29B6D2] border-b-2 border-[#29B6D2] pb-2">What Your Team Gets</h3>
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <Dumbbell className="h-6 w-6 text-[#29B6D2] mx-auto mb-2" />
            <p className="font-bold text-sm">Smarty Workouts</p>
            <p className="text-xs text-gray-500">500+ expert workouts</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <Target className="h-6 w-6 text-[#29B6D2] mx-auto mb-2" />
            <p className="font-bold text-sm">Smarty Programs</p>
            <p className="text-xs text-gray-500">Multi-week plans</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <Calculator className="h-6 w-6 text-[#29B6D2] mx-auto mb-2" />
            <p className="font-bold text-sm">Smarty Tools</p>
            <p className="text-xs text-gray-500">Professional calculators</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <Sparkles className="h-6 w-6 text-[#29B6D2] mx-auto mb-2" />
            <p className="font-bold text-sm">Smarty Ritual</p>
            <p className="text-xs text-gray-500">Daily wellness routines</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <ClipboardCheck className="h-6 w-6 text-[#29B6D2] mx-auto mb-2" />
            <p className="font-bold text-sm">Smarty Check-ins</p>
            <p className="text-xs text-gray-500">Wellness tracking</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <Users className="h-6 w-6 text-[#29B6D2] mx-auto mb-2" />
            <p className="font-bold text-sm">Community</p>
            <p className="text-xs text-gray-500">Team leaderboards</p>
          </div>
        </div>

        {/* Expert */}
        <div className="bg-[#1a1a1a] text-white rounded-xl p-6 flex items-center gap-6">
          <div className="h-24 w-24 flex-shrink-0 rounded-full bg-[#29B6D2]/20 border-2 border-[#29B6D2] overflow-hidden">
            <img 
              src="/lovable-uploads/5b15e21a-12fa-49ff-8a45-6d7b5fa49c55.png"
              alt="Haris Falas - Sports Scientist"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div>
            <p className="text-[#29B6D2] font-bold text-lg">Designed by Haris Falas</p>
            <p className="text-gray-400 mb-2">Sports Scientist | CSCS Certified | 20+ Years Experience</p>
            <p className="text-sm text-gray-300">
              All content is created by a real expert—not algorithms. Your team receives professional-grade 
              coaching backed by sports science and proven training methodologies.
            </p>
          </div>
        </div>
      </div>

      {/* Page 2 */}
      <div className="p-8 md:p-12 max-w-[21cm] mx-auto" style={{ minHeight: '29.7cm' }}>
        {/* Corporate Plans */}
        <h3 className="text-xl font-bold mb-6 text-[#29B6D2] border-b-2 border-[#29B6D2] pb-2">Corporate Plans</h3>
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h4 className="font-bold text-lg mb-1">Smarty Dynamic</h4>
            <p className="text-sm text-gray-500 mb-3">Up to 10 team members</p>
            <p className="text-3xl font-bold mb-4">€699<span className="text-sm text-gray-500">/year</span></p>
            <ul className="text-sm space-y-2">
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> 10 Premium accounts</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Admin dashboard</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Centralized billing</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> All premium content</li>
            </ul>
          </div>
          
          <div className="border-2 border-[#29B6D2] rounded-xl p-5 bg-[#E8F7FA]">
            <div className="bg-[#29B6D2] text-white text-xs px-2 py-1 rounded mb-2 inline-block">POPULAR</div>
            <h4 className="font-bold text-lg mb-1 text-[#29B6D2]">Smarty Power</h4>
            <p className="text-sm text-gray-500 mb-3">Up to 20 team members</p>
            <p className="text-3xl font-bold mb-4">€799<span className="text-sm text-gray-500">/year</span></p>
            <ul className="text-sm space-y-2">
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#29B6D2]" /> 20 Premium accounts</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#29B6D2]" /> Admin dashboard</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#29B6D2]" /> Centralized billing</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#29B6D2]" /> All premium content</li>
            </ul>
          </div>
          
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <h4 className="font-bold text-lg mb-1">Smarty Elite</h4>
            <p className="text-sm text-gray-500 mb-3">Up to 30 team members</p>
            <p className="text-3xl font-bold mb-4">€899<span className="text-sm text-gray-500">/year</span></p>
            <ul className="text-sm space-y-2">
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> 30 Premium accounts</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Admin dashboard</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Centralized billing</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Priority support</li>
            </ul>
          </div>
          
          <div className="border-2 border-gray-800 rounded-xl p-5 bg-[#1a1a1a] text-white">
            <div className="bg-white text-gray-900 text-xs px-2 py-1 rounded mb-2 inline-block">ENTERPRISE</div>
            <h4 className="font-bold text-lg mb-1">Smarty Enterprise</h4>
            <p className="text-sm text-gray-400 mb-3">Unlimited team members</p>
            <p className="text-3xl font-bold mb-4">€999<span className="text-sm text-gray-400">/year</span></p>
            <ul className="text-sm space-y-2">
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#29B6D2]" /> Unlimited accounts</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#29B6D2]" /> Admin dashboard</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#29B6D2]" /> Dedicated support</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#29B6D2]" /> Custom onboarding</li>
            </ul>
          </div>
        </div>

        {/* How It Works */}
        <h3 className="text-xl font-bold mb-6 text-[#29B6D2] border-b-2 border-[#29B6D2] pb-2">How It Works</h3>
        <div className="flex gap-4 mb-8">
          <div className="flex-1 text-center">
            <div className="bg-[#29B6D2] text-white rounded-full w-10 h-10 flex items-center justify-center mx-auto mb-2 font-bold">1</div>
            <p className="font-bold text-sm">Choose Plan</p>
            <p className="text-xs text-gray-500">Select the plan that fits your team size</p>
          </div>
          <div className="flex-1 text-center">
            <div className="bg-[#29B6D2] text-white rounded-full w-10 h-10 flex items-center justify-center mx-auto mb-2 font-bold">2</div>
            <p className="font-bold text-sm">Add Members</p>
            <p className="text-xs text-gray-500">Create accounts for your team members</p>
          </div>
          <div className="flex-1 text-center">
            <div className="bg-[#29B6D2] text-white rounded-full w-10 h-10 flex items-center justify-center mx-auto mb-2 font-bold">3</div>
            <p className="font-bold text-sm">Start Training</p>
            <p className="text-xs text-gray-500">Team gets instant Premium access</p>
          </div>
          <div className="flex-1 text-center">
            <div className="bg-[#29B6D2] text-white rounded-full w-10 h-10 flex items-center justify-center mx-auto mb-2 font-bold">4</div>
            <p className="font-bold text-sm">Track Progress</p>
            <p className="text-xs text-gray-500">Monitor engagement via admin dashboard</p>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a] text-white rounded-xl p-6 mb-8 text-center">
          <h3 className="text-xl font-bold mb-2">Ready to Transform Your Team's Wellness?</h3>
          <p className="text-gray-400 mb-4">Contact us today for a personalized demo and pricing consultation.</p>
          <div className="flex justify-center gap-6">
            <a href="https://smartygym.com/corporate" className="bg-[#29B6D2] text-white px-6 py-2 rounded-lg font-bold inline-block">
              Get Started →
            </a>
          </div>
        </div>

        {/* Contact & Social */}
        <div className="border-t-4 border-[#29B6D2] pt-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg mb-2">Contact Us</h3>
              <p className="text-sm text-gray-600 mb-1">
                <strong>Website:</strong> <a href="https://smartygym.com/corporate" className="text-[#29B6D2]">smartygym.com/corporate</a>
              </p>
              <p className="text-sm text-gray-600 mb-1">
                <strong>Email:</strong> <a href="mailto:smartygym@outlook.com" className="text-[#29B6D2]">smartygym@outlook.com</a>
              </p>
              <p className="text-sm text-gray-600">
                <strong>Support:</strong> <a href="mailto:smartygym@outlook.com" className="text-[#29B6D2]">smartygym@outlook.com</a>
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold mb-2">Follow Us</p>
              <div className="flex gap-4 justify-end text-sm">
                <a href="https://www.instagram.com/thesmartygym/" className="text-[#29B6D2]">Instagram</a>
                <a href="https://www.tiktok.com/@thesmartygym" className="text-[#29B6D2]">TikTok</a>
                <a href="https://www.facebook.com/profile.php?id=61579302997368" className="text-[#29B6D2]">Facebook</a>
                <a href="https://www.youtube.com/@TheSmartyGym" className="text-[#29B6D2]">YouTube</a>
              </div>
            </div>
          </div>
          <div className="text-center mt-6 text-xs text-gray-500">
            © {new Date().getFullYear()} SmartyGym. All rights reserved. | Corporate Wellness Solutions
          </div>
        </div>
      </div>
    </div>
  );
};

export default CorporateBrochure;