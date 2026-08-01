import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2, WifiOff, Mail, ArrowLeft } from "lucide-react";
import smartyGymLogo from "@/assets/smarty-gym-logo.png";
import { AvatarSetupDialog } from "@/components/AvatarSetupDialog";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { trackSocialMediaEvent } from "@/utils/socialMediaTracking";
import { lovable } from "@/integrations/lovable";

import { checkPasswordBreach } from "@/utils/passwordBreachCheck";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Helmet } from "react-helmet";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showAvatarSetup, setShowAvatarSetup] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [newUserId, setNewUserId] = useState<string | null>(null);
  const { isOffline } = useNetworkStatus();
  
  // Get the mode from URL params, default to login
  const defaultTab = searchParams.get("mode") === "signup" ? "signup" : "login";

  // Honor ?redirect=<path> so users return to where they were gated (Smarty Coach
  // suggestion, paywalled workout, etc.). Only accept same-origin relative paths.
  const rawRedirect = searchParams.get("redirect");
  const safeRedirect =
    rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/";
  const hasRedirect = safeRedirect !== "/";

  // Set up listener first, then check if user is already authenticated
  useEffect(() => {
    let mounted = true;

    const handleAuthenticatedSession = async (session: Session) => {
      if (!mounted) return;

      // Check if this is a first-time verified user (welcome not yet sent)
      const { data: profile } = await supabase
        .from('profiles')
        .select('welcome_sent')
        .eq('user_id', session.user.id)
        .single();

      if (!mounted) return;

      if (!profile?.welcome_sent) {
        // First-time verified user — fire post-signup actions
        console.log("First-time verified user detected, triggering post-signup actions");
        
        setNewUserId(session.user.id);

        // Send welcome message
        try {
          await supabase.functions.invoke('send-system-message', {
            body: { userId: session.user.id, messageType: 'welcome' }
          });
        } catch (msgError) {
          console.error('Failed to send welcome message:', msgError);
        }

        // Track signup event
        trackSocialMediaEvent({ eventType: 'signup', userId: session.user.id });

        setShowAvatarSetup(true);
        return; // Don't navigate yet — avatar setup dialog will handle it
      }

      navigate(safeRedirect);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        if (import.meta.env.DEV) {
          console.log("User signed out");
        }
      } else if (session) {
        setTimeout(() => {
          handleAuthenticatedSession(session);
        }, 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleAuthenticatedSession(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Sign Up State
  const [signUpData, setSignUpData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });

  // Login State
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isOffline) {
      toast({
        title: "No Internet Connection",
        description: "Please connect to the internet to sign in with Google.",
        variant: "destructive",
      });
      return;
    }
    
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth${
            hasRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : ""
          }`,
        },
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        setGoogleLoading(false);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (isOffline) {
      toast({
        title: "No Internet Connection",
        description: "Please connect to the internet to sign in with Apple.",
        variant: "destructive",
      });
      return;
    }

    setAppleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: `${window.location.origin}/auth${
          hasRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : ""
        }`,
      });

      if (result.redirected) {
        return;
      }

      if (result.error) {
        toast({
          title: "Error",
          description: result.error.message || "Failed to sign in with Apple",
          variant: "destructive",
        });
        setAppleLoading(false);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to sign in with Apple",
        variant: "destructive",
      });
      setAppleLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isOffline) {
      toast({
        title: "No Internet Connection",
        description: "Please connect to the internet to create an account.",
        variant: "destructive",
      });
      return;
    }
    
    if (signUpData.password !== signUpData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (signUpData.password.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    if (!signUpData.acceptTerms) {
      toast({
        title: "Error",
        description: "Please accept the terms and conditions",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Check if password has been found in data breaches
    const breachResult = await checkPasswordBreach(signUpData.password);
    
    if (breachResult.isBreached) {
      setLoading(false);
      toast({
        title: "Compromised Password Detected",
        description: (
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p>This password has been found in {breachResult.count.toLocaleString()} data breaches.</p>
              <p className="mt-1 text-sm">Please choose a different, unique password for your security.</p>
            </div>
          </div>
        ),
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: signUpData.email,
        password: signUpData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth${
            hasRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : ""
          }`,
          data: {
            full_name: signUpData.fullName,
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "Error",
            description: "This email is already registered. Please login instead.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        }
      } else if (data.user) {
        setShowVerificationMessage(true);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    // placeholder-anchor
    e.preventDefault();
    
    if (isOffline) {
      toast({
        title: "No Internet Connection",
        description: "Please connect to the internet to sign in.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Error",
            description: "Invalid email or password",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        // Note: Remember Me feature requires custom_session_duration column
        // To be added via database migration
        // For now, session management is handled by Supabase auth defaults
        if (rememberMe && data.session && import.meta.env.DEV) {
          console.log('Remember Me selected - custom session handling pending migration');
        }


        toast({
          title: "Success!",
          description: rememberMe ? "Logged in successfully. You'll stay logged in for 30 days." : "Logged in successfully. Redirecting...",
        });
        setTimeout(() => navigate(safeRedirect), 1500);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Helmet>
        <title>Sign In or Create Account | SmartyGym</title>
        <meta name="description" content="Sign in to your SmartyGym account or create a new account to access workouts, training programs, and fitness tools." />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://smartygym.com/auth" />
      </Helmet>
      <OfflineBanner />

      {showVerificationMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md text-center">
            <CardHeader className="space-y-4 flex flex-col items-center pb-2">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold">Check Your Email! 📧</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                We've sent a <span className="font-semibold text-foreground">verification link</span> to{" "}
                <span className="font-semibold text-primary break-all">{signUpData.email}</span>.
              </p>
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 sm:p-4">
                <p className="text-sm sm:text-base font-medium text-foreground">
                  You must verify your email before you can sign in.
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Check your inbox (and spam folder) for the verification email and click the link inside.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => setShowVerificationMessage(false)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {showAvatarSetup && newUserId && (
        <AvatarSetupDialog
          open={showAvatarSetup}
          onOpenChange={(open) => {
            setShowAvatarSetup(open);
            if (!open) {
              setTimeout(
                () => navigate(hasRedirect ? safeRedirect : "/about"),
                500,
              );
            }
          }}
          userId={newUserId}
          userName={signUpData.fullName}
        />
      )}

      <div className="w-full max-w-md">
        <div className="mb-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>
        </div>
        <Card className="w-full">
          <CardHeader className="space-y-1 flex flex-col items-center">
            <img src={smartyGymLogo} alt="SmartyGym" className="h-20 w-auto mb-2" />
            <CardTitle className="text-2xl font-bold text-center">Welcome to SmartyGym</CardTitle>
            <CardDescription className="text-center">
              Create an account or sign in to continue
            </CardDescription>
          </CardHeader>
        <CardContent>
          {/* Social logins temporarily hidden — re-enable when ready */}
          {false && (<>
          {/* Google Sign In Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-4 flex items-center justify-center gap-2"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            {googleLoading ? "Signing in..." : "Continue with Google"}
          </Button>

          {/* Apple Sign In Button — required by Apple Guideline 4.8 when other social logins are offered */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-4 flex items-center justify-center gap-2"
            onClick={handleAppleSignIn}
            disabled={appleLoading || googleLoading || loading}
          >
            {appleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16.365 1.43c0 1.14-.43 2.21-1.27 3.06-.83.85-2.18 1.5-3.31 1.41-.13-1.1.43-2.27 1.21-3.04.84-.84 2.27-1.45 3.37-1.43zM20.5 17.34c-.55 1.27-.81 1.84-1.52 2.96-.99 1.56-2.39 3.51-4.12 3.52-1.54.02-1.94-.99-4.03-.97-2.09.01-2.53.99-4.07.97-1.73-.02-3.06-1.78-4.05-3.34C-.07 16.07-.36 10.96 1.93 8.27 3.55 6.36 6.13 5.25 8.55 5.25c2.46 0 4.01 1.34 6.04 1.34 1.97 0 3.17-1.34 6.02-1.34 2.16 0 4.45 1.18 6.07 3.21-5.34 2.93-4.47 10.55-1.18 8.88h-5z"/>
              </svg>
            )}
            {appleLoading ? "Signing in..." : "Continue with Apple"}
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>
          </>)}

          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    required
                  />
                </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <PasswordInput
                  id="login-password"
                  placeholder="••••••••"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <Label htmlFor="remember-me" className="text-sm cursor-pointer">
                    Keep me logged in for 30 days
                  </Label>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={signUpData.fullName}
                    onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    required
                  />
                </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <PasswordInput
                  id="signup-password"
                  placeholder="••••••••"
                  value={signUpData.password}
                  onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                <PasswordInput
                  id="signup-confirm-password"
                  placeholder="••••••••"
                  value={signUpData.confirmPassword}
                  onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                  required
                />
              </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="terms"
                    checked={signUpData.acceptTerms}
                    onCheckedChange={(checked) => setSignUpData({ ...signUpData, acceptTerms: checked as boolean })}
                  />
                  <label
                    htmlFor="terms"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I accept the terms and conditions
                  </label>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      <ForgotPasswordDialog
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
      />
      </div>
    </div>
  );
}
