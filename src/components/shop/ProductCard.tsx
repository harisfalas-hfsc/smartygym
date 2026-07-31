import { useState } from "react";
import { ExternalLink, Star, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { platformHeader } from "@/utils/platform";
import { usePaymentsEnabled } from "@/hooks/usePaymentsEnabled";
import { PaymentsDisabledNotice } from "@/components/PaymentsDisabledNotice";

interface ProductCardProps {
  product: {
    id: string;
    title: string;
    description: string;
    category: string;
    product_type: string;
    amazon_url?: string;
    price?: number;
    price_range?: string;
    image_url: string;
    is_featured: boolean;
    stripe_price_id?: string;
    stock_quantity?: number;
  };
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const { paymentsEnabled } = usePaymentsEnabled();

  // Check stock availability for direct sale products
  const isOutOfStock = product.product_type === 'direct_sale' && 
                        product.stock_quantity !== null && 
                        product.stock_quantity !== undefined &&
                        product.stock_quantity <= 0;

  const handleDirectPurchase = async () => {
    try {
      setIsProcessing(true);

      // Check if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.info("Create a free account to complete your purchase", {
          description: "You'll be redirected to sign up, then back to complete your order",
          duration: 4000,
        });
        // Store the product info in session storage to redirect back after auth
        sessionStorage.setItem('pendingPurchase', JSON.stringify({
          productId: product.id,
          productTitle: product.title,
          returnUrl: window.location.pathname
        }));
        navigate("/auth?redirect=shop");
        return;
      }

      if (!product.stripe_price_id) {
        toast.error("Product configuration error");
        return;
      }

      // Call checkout function
      const { data, error } = await supabase.functions.invoke(
        'create-individual-purchase-checkout',
        {
          body: {
            contentType: 'shop_product',
            contentId: product.id,
            contentName: product.title,
            stripePriceId: product.stripe_price_id,
            imageUrl: product.image_url,
            cancelPath: window.location.pathname + window.location.search,
          },
          headers: platformHeader(),
        }
      );

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      toast.error(error.message || "Failed to start checkout");
    } finally {
      setIsProcessing(false);
    }
  };

  const isDirectSale = product.product_type === 'direct_sale';

  return (
    <Card className="h-full flex flex-col hover:shadow-lg transition-all duration-300 hover:scale-[1.01] group">
      <CardHeader className="p-0">
        <div className="relative overflow-hidden rounded-t-lg h-48 bg-muted">
          {product.is_featured && (
            <Badge className="absolute top-2 left-2 z-10 bg-primary/90 backdrop-blur-sm">
              <Star className="w-3 h-3 mr-1" />
              Featured
            </Badge>
          )}
          {isDirectSale && (
            <Badge className="absolute top-2 right-2 z-10 bg-green-600/90 backdrop-blur-sm">
              <ShoppingCart className="w-3 h-3 mr-1" />
              Direct from SmartyGym
            </Badge>
          )}
          <img
            src={product.image_url}
            alt={product.title}
            className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = '/placeholder.svg';
              e.currentTarget.classList.add('opacity-50');
            }}
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-4 space-y-2">
        <h3 className="text-lg font-semibold line-clamp-2 leading-tight">
          {product.title}
        </h3>
        <Badge variant="outline" className="mb-2 text-xs">
          {product.category}
        </Badge>
        <p className="text-muted-foreground text-sm line-clamp-2 leading-relaxed">
          {product.description}
        </p>
        <p className="text-base font-bold text-primary pt-1">
          {isDirectSale ? `€${product.price?.toFixed(2)}` : product.price_range}
        </p>
        {isDirectSale && product.stock_quantity !== null && product.stock_quantity !== undefined && (
          <p className="text-xs text-muted-foreground">
            {product.stock_quantity > 0 
              ? `Only ${product.stock_quantity} left in stock` 
              : "Out of stock"}
          </p>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0">
        {isDirectSale ? (
          !paymentsEnabled ? (
            <PaymentsDisabledNotice compact />
          ) : (
          <Button 
            className="w-full" 
            size="sm"
            onClick={handleDirectPurchase}
            disabled={isProcessing || (product.stock_quantity !== null && product.stock_quantity === 0)}
          >
            {isProcessing ? "Processing..." : `Buy Now for €${product.price?.toFixed(2)}`}
            <ShoppingCart className="w-3.5 h-3.5" />
          </Button>
          )
        ) : (
          <a
            href={product.amazon_url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="w-full"
          >
            <Button className="w-full" size="sm">
              View on Amazon
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </a>
        )}
      </CardFooter>
    </Card>
  );
};