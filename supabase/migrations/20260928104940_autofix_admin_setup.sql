-- Only a SHA-256 digest is stored; the one-time code stays outside the repository.
insert into public.ofa_setup_config(id,code_hash) values(true,'123f38f4de7d1fab55bc21dcac61910592003831145cd1b14e6f1dc0ec620daf');
