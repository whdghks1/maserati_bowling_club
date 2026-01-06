import React, { useState } from "react";
import { useRouter } from "next/router";

const Login = () => {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                const msg = data?.message || data?.error || "Login failed";
                throw new Error(msg);
            }

            // 토큰 저장(서버가 token을 준다는 가정)
            if (data?.token) localStorage.setItem("token", data.token);

            alert("Login successful");
            router.push("/record"); // 로그인 후 이동 (원하는 페이지로 바꿔도 됨)
        } catch (err) {
            console.error(err);
            alert(err?.message || "Error logging in");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2>Login</h2>

            <form onSubmit={handleSubmit}>
                <div>
                    <label>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>

                <div>
                    <label>Password:</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                    />
                </div>

                <button type="submit" disabled={loading}>
                    {loading ? "Logging in..." : "Login"}
                </button>
            </form>
        </div>
    );
};

export default Login;
