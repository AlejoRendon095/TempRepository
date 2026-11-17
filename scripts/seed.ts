import { AppDataSource } from '../src/config/typeorm.config';
import * as bcrypt from 'bcrypt';
import { User } from '../src/users/user.entity';
import { UserRole } from '../src/common/enums/user-role.enum';

async function runSeed() {
  console.log('🌱 Iniciando seed...');

  await AppDataSource.initialize();
  console.log('✅ Conexión a BD establecida');

  const userRepository = AppDataSource.getRepository(User);

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('❌ SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD son obligatorios');
    process.exit(1);
  }

  const existingAdmin = await userRepository.findOne({ where: { email: adminEmail } });

  if (existingAdmin) {
    console.log(`ℹ️  Usuario admin ya existe: ${adminEmail}`);
    existingAdmin.role = UserRole.ADMIN;
    existingAdmin.passwordHash = await bcrypt.hash(adminPassword, 12);
    await userRepository.save(existingAdmin);
    console.log('✅ Admin actualizado (role=ADMIN, password hasheado)');
  } else {
    const admin = userRepository.create({
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: UserRole.ADMIN,
      twoFaEnabled: false,
    });
    await userRepository.save(admin);
    console.log(`✅ Admin creado: ${adminEmail} (role=ADMIN)`);
  }

  const moderatorEmail = process.env.SEED_MODERATOR_EMAIL;
  const moderatorPassword = process.env.SEED_MODERATOR_PASSWORD;

  if (moderatorEmail && moderatorPassword) {
    const existingMod = await userRepository.findOne({ where: { email: moderatorEmail } });
    if (existingMod) {
      existingMod.role = UserRole.MODERATOR;
      existingMod.passwordHash = await bcrypt.hash(moderatorPassword, 12);
      await userRepository.save(existingMod);
      console.log('✅ Moderador actualizado');
    } else {
      const mod = userRepository.create({
        email: moderatorEmail,
        passwordHash: await bcrypt.hash(moderatorPassword, 12),
        role: UserRole.MODERATOR,
        twoFaEnabled: false,
      });
      await userRepository.save(mod);
      console.log(`✅ Moderador creado: ${moderatorEmail}`);
    }
  }

  const demoEmail = process.env.SEED_DEMO_EMAIL;
  const demoPassword = process.env.SEED_DEMO_PASSWORD;

  if (demoEmail && demoPassword) {
    const existingDemo = await userRepository.findOne({ where: { email: demoEmail } });
    if (existingDemo) {
      existingDemo.role = UserRole.USER;
      existingDemo.passwordHash = await bcrypt.hash(demoPassword, 12);
      await userRepository.save(existingDemo);
      console.log('✅ Usuario demo actualizado');
    } else {
      const demo = userRepository.create({
        email: demoEmail,
        passwordHash: await bcrypt.hash(demoPassword, 12),
        role: UserRole.USER,
        twoFaEnabled: false,
      });
      await userRepository.save(demo);
      console.log(`✅ Usuario demo creado: ${demoEmail}`);
    }
  }

  await AppDataSource.destroy();
  console.log('🏁 Seed completado');
}

runSeed().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});