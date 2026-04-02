import { createContext, useContext, useState, useEffect, useRef } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
    const [items, setItems] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('cart') || '[]');
        } catch { return []; }
    });
    const [toast, setToast] = useState(null); // { name, qty }
    const toastTimer = useRef(null);

    useEffect(() => {
        localStorage.setItem('cart', JSON.stringify(items));
    }, [items]);

    const showToast = (name) => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ name });
        toastTimer.current = setTimeout(() => setToast(null), 2200);
    };

    const addToCart = (product, branchId) => {
        setItems(prev => {
            const existing = prev.find(i => i.productId === product._id);
            if (existing) {
                return prev.map(i =>
                    i.productId === product._id
                        ? { ...i, qty: i.qty + 1 }
                        : i
                );
            }
            return [...prev, {
                productId: product._id,
                name: product.name,
                price: product.price,
                imageType: product.imageType || 'blister',
                category: product.category,
                qty: 1,
                branchId,
            }];
        });
        showToast(product.name);
    };

    const removeFromCart = (productId) => {
        setItems(prev => prev.filter(i => i.productId !== productId));
    };

    const updateQty = (productId, qty) => {
        if (qty <= 0) return removeFromCart(productId);
        setItems(prev => prev.map(i =>
            i.productId === productId ? { ...i, qty } : i
        ));
    };

    const clearCart = () => setItems([]);

    const count = items.reduce((sum, i) => sum + i.qty, 0);
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    return (
        <CartContext.Provider value={{
            items, addToCart, removeFromCart, updateQty, clearCart, count, total, toast,
        }}>
            {children}
        </CartContext.Provider>
    );
}

export const useCart = () => useContext(CartContext);
