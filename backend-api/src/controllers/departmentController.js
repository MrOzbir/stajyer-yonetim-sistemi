const prisma = require('../config/database');
const { formatToTurkeyTime } = require('../utils/formatters');

exports.createDepartment = async (req, res) => {
    try {
        const { name, description, color } = req.body;
        if (!name || name.trim() === '') return res.status(400).json({ error: "Departman adı zorunludur." });

        const existing = await prisma.department.findUnique({ where: { name } });
        if (existing) return res.status(400).json({ error: `"${name}" adında bir departman zaten var.` });

        const newDept = await prisma.department.create({
            data: { name: name.trim(), description: description || null, color: color || '#0084ff' }
        });

        res.status(201).json({ message: `"${newDept.name}" departmanı başarıyla oluşturuldu!`, department: newDept });
    } catch (error) {
        console.error("🚨 DEPARTMAN OLUŞTURMA HATASI:", error);
        res.status(500).json({ error: "Departman oluşturulurken hata oluştu." });
    }
};

exports.getAllDepartments = async (req, res) => {
    try {
        const departments = await prisma.department.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: {
                        members: { where: { isArchived: false, role: 'INTERN' } }
                    }
                }
            }
        });

        const enriched = departments.map(dept => ({
            id: dept.id, name: dept.name, description: dept.description, color: dept.color,
            internCount: dept._count.members, createdAt: formatToTurkeyTime(dept.createdAt)
        }));

        res.status(200).json(enriched);
    } catch (error) {
        console.error("🚨 DEPARTMAN LİSTELEME HATASI:", error);
        res.status(500).json({ error: "Departmanlar listelenirken hata oluştu." });
    }
};

exports.updateDepartment = async (req, res) => {
    try {
        const deptId = parseInt(req.params.id);
        const { name, description, color } = req.body;

        const existing = await prisma.department.findUnique({ where: { id: deptId } });
        if (!existing) return res.status(404).json({ error: "Departman bulunamadı." });

        if (name && name !== existing.name) {
            const nameConflict = await prisma.department.findUnique({ where: { name } });
            if (nameConflict) return res.status(400).json({ error: `"${name}" adı zaten kullanımda.` });
        }

        const updated = await prisma.department.update({
            where: { id: deptId },
            data: {
                ...(name && { name: name.trim() }),
                ...(description !== undefined && { description }),
                ...(color && { color })
            }
        });

        res.status(200).json({ message: "Departman güncellendi!", department: updated });
    } catch (error) {
        console.error("🚨 DEPARTMAN GÜNCELLEME HATASI:", error);
        res.status(500).json({ error: "Departman güncellenirken hata oluştu." });
    }
};

exports.deleteDepartment = async (req, res) => {
    try {
        const deptId = parseInt(req.params.id);
        const existing = await prisma.department.findUnique({
            where: { id: deptId },
            include: { _count: { select: { members: true } } }
        });

        if (!existing) return res.status(404).json({ error: "Departman bulunamadı." });

        await prisma.department.delete({ where: { id: deptId } });

        res.status(200).json({
            message: `"${existing.name}" departmanı silindi. ${existing._count.members} üyenin departmanı "Belirtilmemiş" olarak güncellendi.`,
            deletedId: deptId
        });
    } catch (error) {
        console.error("🚨 DEPARTMAN SİLME HATASI:", error);
        res.status(500).json({ error: "Departman silinirken hata oluştu." });
    }
};

exports.assignUserDepartment = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { departmentId } = req.body;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı." });

        if (departmentId !== null) {
            const dept = await prisma.department.findUnique({ where: { id: parseInt(departmentId) } });
            if (!dept) return res.status(404).json({ error: "Departman bulunamadı." });
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: { departmentId: departmentId === null ? null : parseInt(departmentId) },
            include: { department: true }
        });

        res.status(200).json({
            message: `${updated.name} ${updated.surname} → ${updated.department?.name || 'Departmansız'}`,
            user: { id: updated.id, name: updated.name, department: updated.department }
        });
    } catch (error) {
        console.error("🚨 KULLANICI DEPARTMAN GÜNCELLEME HATASI:", error);
        res.status(500).json({ error: "Departman ataması başarısız." });
    }
};