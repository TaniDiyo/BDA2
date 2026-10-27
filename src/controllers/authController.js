const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

let registrationQueue = Promise.resolve();

function publicUser(user) {
  const role = (user.role || "ANALYST").toUpperCase();
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role,
    createdAt: user.createdAt
  };
}

function signToken(user) {
  if (!process.env.JWT_SECRET) {
    const error = new Error("JWT_SECRET is not configured.");
    error.status = 500;
    throw error;
  }
  const role = (user.role || "ANALYST").toUpperCase();
  return jwt.sign(
    { sub: user._id.toString(), role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

async function register(req, res) {
  const password = await bcrypt.hash(req.body.password, 12);
  const registration = registrationQueue.then(async () => {
    const isFirstUser = (await User.countDocuments({ role: "ADMIN", email: { $ne: "admin@fraudlens.com" } })) === 0;
    return User.create({
      name: req.body.name,
      email: req.body.email,
      password,
      role: isFirstUser ? "ADMIN" : "ANALYST"
    });
  });
  registrationQueue = registration.catch(() => undefined);
  let user;
  try {
    user = await registration;
  } catch (error) {
    if (error.code === 11000) {
      error.status = 409;
      error.message = "An account with this email already exists. Click 'Sign in' below to log in.";
    }
    throw error;
  }

  const userResponse = publicUser(user);
  return res.status(201).json({
    token: signToken(user),
    user: userResponse
  });
}

async function login(req, res) {
  const user = await User.findOne({ email: req.body.email }).select("+password +passwordHash");
  const storedHash = user?.password || user?.passwordHash;
  if (!user || !storedHash || !(await bcrypt.compare(req.body.password, storedHash))) {
    const error = new Error("Invalid email or password.");
    error.status = 401;
    throw error;
  }
  if (!user.password && user.passwordHash) {
    user.password = user.passwordHash;
    await user.save();
  }
  return res.json({ token: signToken(user), user: publicUser(user) });
}

async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) {
    const error = new Error("User account no longer exists.");
    error.status = 401;
    throw error;
  }
  return res.json({ user: publicUser(user) });
}

module.exports = { register, login, me };
